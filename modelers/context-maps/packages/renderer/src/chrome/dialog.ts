import { chromeIcon } from "../draw/lucide.js";

/** What a dialog needs of the chrome around the map; a `@miragon/modeler-shell` handle fits. */
export interface DialogChrome {
  /** Where the dialog lives (the shell root), so it shares the chrome's mode and fonts. */
  readonly root: HTMLElement;
  readonly messages: { readonly close: string };
  /** The control the focus returns to once the dialog closes. */
  readonly menu: { readonly trigger: HTMLElement };
}

export interface ChromeDialog {
  open(): void;
  isOpen(): boolean;
  close(): void;
  destroy(): void;
}

export interface ChromeDialogSpec {
  /** Class of the `<dialog>` next to `cm-dialog`, for the dialog's own rules. */
  readonly className: string;
  readonly titleId: string;
  readonly title: string;
  /** The parts below the header, built once on the first open. */
  content(close: () => void): Node[];
  /** Runs before every open, while the dialog is still closed. */
  beforeOpen?(): void;
  /** Runs after every open, once the dialog shows and holds the focus. */
  afterOpen?(): void;
}

export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const created = document.createElement(tag);
  created.className = className;
  if (text !== undefined) created.textContent = text;
  return created;
}

function header(chrome: DialogChrome, spec: ChromeDialogSpec, onClose: () => void): HTMLElement {
  const head = element("header", "cm-dialog-header");
  const title = element("h3", "cm-dialog-title", spec.title);
  title.id = spec.titleId;
  const close = element("button", "cm-dialog-close");
  close.type = "button";
  close.setAttribute("aria-label", chrome.messages.close);
  close.innerHTML = chromeIcon("x");
  close.addEventListener("click", onClose);
  head.append(title, close);
  return head;
}

/**
 * A dialog of the map's chrome (guide §8, "Modeler dialogs" of the shell's API): a native modal
 * <dialog> inside the chrome's root, so the browser keeps the focus inside it and closes it on
 * Escape. Built on the first open and kept (closed) afterwards; `destroy()` removes it. The host
 * calls it with the diagram's teardown, since the chrome removes only what it added itself.
 */
export function createChromeDialog(chrome: DialogChrome, spec: ChromeDialogSpec): ChromeDialog {
  let dialog: HTMLDialogElement | undefined;

  function build(): HTMLDialogElement {
    const created = element("dialog", `cm-dialog ${spec.className}`);
    created.setAttribute("aria-labelledby", spec.titleId);
    const close = (): void => created.close();
    const panel = element("div", "cm-dialog-panel");
    panel.append(header(chrome, spec, close), ...spec.content(close));
    created.append(panel);
    // A click on the backdrop targets the <dialog> itself; the panel covers all of its own box.
    created.addEventListener("click", (event) => {
      if (event.target === created) created.close();
    });
    created.addEventListener("close", () => {
      if (!chrome.menu.trigger.hidden) chrome.menu.trigger.focus({ preventScroll: true });
    });
    chrome.root.append(created);
    return created;
  }

  return {
    open() {
      dialog ??= build();
      if (dialog.open) return;
      spec.beforeOpen?.();
      dialog.showModal();
      spec.afterOpen?.();
    },
    close() {
      dialog?.close();
    },
    isOpen: () => dialog?.open === true,
    destroy() {
      dialog?.remove();
      dialog = undefined;
    },
  };
}
