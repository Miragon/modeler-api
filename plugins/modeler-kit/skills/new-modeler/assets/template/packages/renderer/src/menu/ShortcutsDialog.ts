import { lucideIcon } from '../draw/lucide.js';
import { diagramShortcuts, type ShortcutGroup, type ShortcutsChrome } from './shortcuts.js';

const DIALOG_CLASS = 'diagram-shortcuts';

/** What the dialog needs of the chrome; a `@miragon/modeler-shell` handle fits. */
export interface ShortcutsDialogChrome extends ShortcutsChrome {
  /** Where the dialog lives (the shell root), so it shares the chrome's mode and fonts. */
  readonly root: HTMLElement;
  readonly messages: ShortcutsChrome['messages'] & { readonly close: string };
  /** The control the focus returns to once the dialog closes. */
  readonly menu: { readonly trigger: HTMLElement };
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

/**
 * The Help group's "Keyboard shortcuts…" dialog (guide §5.4, §8): a modal `<dialog>` in the
 * shell root, closed by Escape, the backdrop and its Close button, the focus back on the menu
 * trigger. Usable on a read-only canvas. The modeler removes it in its own teardown
 * (`diagram.destroy`), since the shell removes only what it added.
 */
export function createShortcutsDialog(chrome: ShortcutsDialogChrome): ShortcutsDialog {
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
  for (const group of diagramShortcuts(chrome)) body.append(table(group));
  dialog.append(header, body);
  chrome.root.append(dialog);

  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => chrome.menu.trigger.focus());

  return {
    open: () => {
      if (!dialog.open) dialog.showModal();
    },
    isOpen: () => dialog.open,
    close: () => dialog.close(),
    destroy: () => dialog.remove(),
  };
}
