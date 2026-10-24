import { lucideIcon } from '../draw/lucide.js';
import { diagramShortcuts, type ShortcutGroup, type ShortcutsChrome } from './shortcuts.js';

const DIALOG_CLASS = 'diagram-shortcuts';
// The rule of the shell's isTextField, which a renderer does not import.
const TEXT_FIELD =
  "input, textarea, select, [contenteditable]:not([contenteditable='false']), .monaco-editor";
const DIALOG = 'dialog, [role="dialog"], [role="alertdialog"]';

/** What the dialog needs of the chrome; a `@miragon/modeler-shell` handle fits. */
export interface ShortcutsDialogChrome extends ShortcutsChrome {
  /** Where the dialog lives (the shell root), so it shares the chrome's mode and fonts. */
  readonly root: HTMLElement;
  readonly messages: ShortcutsChrome['messages'] & { readonly close: string };
  /** The control the focus returns to once the dialog closes, unless its key opened it elsewhere. */
  readonly menu: {
    readonly trigger: HTMLElement;
    isOpen?(): boolean;
    close?(options?: { restoreFocus?: boolean }): void;
  };
  /** The web app's start screen shows: no diagram, so its key opens nothing. */
  isEmptyStateShown?(): boolean;
}

export interface ShortcutsDialogOptions {
  /**
   * The key that opens the dialog (`SHORTCUTS_KEY`), also listed in it. Left out, nothing listens:
   * the VS Code webview passes every key it does not need on to VS Code (guide §13.5), and a page
   * the modeler is embedded in keeps its keys.
   */
  readonly shortcutsKey?: string | undefined;
}

export interface ShortcutsDialog {
  open(): void;
  isOpen(): boolean;
  close(): void;
  destroy(): void;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const created = document.createElement(tag);
  created.className = className;
  if (text !== undefined) created.textContent = text;
  return created;
}

function table(group: ShortcutGroup): HTMLElement {
  const section = element('section', `${DIALOG_CLASS}-group`);
  section.append(element('h3', `${DIALOG_CLASS}-group-title`, group.title));
  const rows = element('table', `${DIALOG_CLASS}-table`);
  const body = rows.createTBody();
  for (const row of group.rows) {
    const line = body.insertRow();
    const action = element('th', `${DIALOG_CLASS}-action`, row.action);
    action.scope = 'row';
    const keys = element('td', `${DIALOG_CLASS}-keys`);
    for (const key of row.keys) keys.append(element('kbd', `${DIALOG_CLASS}-key`, key));
    line.append(action, keys);
  }
  section.append(rows);
  return section;
}

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return (
    (target as HTMLElement).isContentEditable === true ||
    ((target as { editContext?: unknown }).editContext ?? null) !== null ||
    target.closest(TEXT_FIELD) !== null
  );
}

function isShown(dialog: Element): boolean {
  if (dialog instanceof HTMLDialogElement) return dialog.open;
  return (
    dialog.closest('[hidden]') === null && dialog.checkVisibility({ visibilityProperty: true })
  );
}

function opensDialog(event: KeyboardEvent, key: string): boolean {
  return (
    event.key === key &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !event.isComposing &&
    !event.defaultPrevented &&
    !isTextField(event.target)
  );
}

/**
 * The Help group's "Keyboard shortcuts…" dialog (guide §5.4, §8): a modal `<dialog>` in the
 * shell root, closed by Escape, the backdrop and its Close button, the focus back where it was
 * (the menu trigger after the menu entry). Usable on a read-only canvas. With `shortcutsKey` the
 * key opens it from anywhere but a text field, another dialog and the start screen. The modeler
 * removes it in its own teardown (`diagram.destroy`), since the shell removes only what it added.
 */
export function createShortcutsDialog(
  chrome: ShortcutsDialogChrome,
  options: ShortcutsDialogOptions = {},
): ShortcutsDialog {
  const { shortcutsKey } = options;
  const page = chrome.root.ownerDocument;
  const dialog = element('dialog', DIALOG_CLASS);
  dialog.setAttribute('aria-labelledby', `${DIALOG_CLASS}-title`);
  const header = element('header', `${DIALOG_CLASS}-header`);
  const title = element('h2', `${DIALOG_CLASS}-title`, 'Keyboard shortcuts');
  title.id = `${DIALOG_CLASS}-title`;
  const close = element('button', `${DIALOG_CLASS}-close`);
  close.type = 'button';
  close.setAttribute('aria-label', chrome.messages.close);
  close.innerHTML = lucideIcon('x');
  header.append(title, close);
  const body = element('div', `${DIALOG_CLASS}-body`);
  for (const group of diagramShortcuts(chrome, { shortcutsKey })) body.append(table(group));
  dialog.append(header, body);
  chrome.root.append(dialog);

  let returnFocus: HTMLElement | SVGElement | undefined;
  const open = () => {
    if (dialog.open) return;
    const active = page.activeElement;
    returnFocus =
      active !== page.body && (active instanceof HTMLElement || active instanceof SVGElement)
        ? active
        : undefined;
    dialog.showModal();
  };

  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    const target = returnFocus?.isConnected ? returnFocus : chrome.menu.trigger;
    returnFocus = undefined;
    target.focus();
  });

  const onKey = (event: KeyboardEvent) => {
    if (!shortcutsKey || !opensDialog(event, shortcutsKey)) return;
    if (chrome.isEmptyStateShown?.() || [...page.querySelectorAll(DIALOG)].some(isShown)) return;
    event.preventDefault();
    if (chrome.menu.isOpen?.()) chrome.menu.close?.({ restoreFocus: true });
    open();
  };
  // Capture: an open menu consumes printable keys for its type-ahead before they bubble.
  if (shortcutsKey) page.addEventListener('keydown', onKey, true);

  return {
    open,
    isOpen: () => dialog.open,
    close: () => dialog.close(),
    destroy: () => {
      page.removeEventListener('keydown', onKey, true);
      dialog.remove();
    },
  };
}
