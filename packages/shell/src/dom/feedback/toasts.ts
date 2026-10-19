import type { ShellHost, ShellMessages, ToastRequest } from "../../core/index.js";
import { createElement } from "../element.js";
import type { ToastHandle } from "../types.js";

export interface ToasterContext {
  ownerDocument: Document;
  /** `web`: the stack is a `popover="manual"` raised on every toast; `embedded`: absolute in the root. */
  host: Exclude<ShellHost, "ide">;
  messages: ShellMessages;
  /** Where the focus goes when a closing toast held it and no other toast can take it. */
  focusFallback(): void;
}

export interface Toaster {
  /** The stack `<div class="cd-shell-toasts" data-chrome="toasts">`, always in the DOM, empty = no box. */
  readonly element: HTMLElement;
  show(request: ToastRequest): ToastHandle;
  /** The stack's `bottom` in px from `toastStackBottom`, set by the shell's layout pass. */
  setBottom(bottom: number): void;
  destroy(): void;
}

/**
 * The toast stack (guide §8, §9): centred at `bottom` (`toastStackBottom`), `toastStackWidth`
 * wide, column with 8px gap, newest at the bottom, layer 60 (`--cd-shell-ebene-toast`). In the
 * web host the stack is a manual popover, re-shown on every toast, so it stays above a
 * `showModal()` dialog in the top layer; in the embedded host it is absolute inside the root.
 *
 * A toast: `<div class="cd-shell-toast" data-status role="status|alert">` (`alert` for danger,
 * `status` with its implicit polite live region otherwise), opaque `--cd-ui-flaeche-hoch`, 1px
 * `--cd-ui-linie`, a straight 4px bar and an 8px dot in `--cd-ui-<status>`, radius `md`,
 * `shadow-3`, at least 40px high, padding `4px 4px 4px 16px`, gap 8px, text 13px/1.5
 * `--cd-ui-text`; then the action as a 32px ghost button and Close as a 32 × 32 ghost icon button
 * (Lucide `x`, `aria-label` `messages.close`). Slide and fade in from `translateY(8px)` (250ms),
 * out the same way; none under reduced motion.
 *
 * Lifetime `toastLifetime(request)`, paused while hovered or focused (and resumed with at least
 * 1.5 s left); a toast with an action never closes by itself. A fourth toast evicts per
 * `toastToEvict`. A request equal to a shown toast (status and text) restarts that toast's timer
 * instead of stacking a second. An action click closes the toast, then runs `onSelect`. A closing
 * toast that held the focus hands it to the next toast's Close button, else `focusFallback()`.
 */
export function createToaster(context: ToasterContext): Toaster {
  // TODO(feedback): the stack and toasts above.
  const { ownerDocument } = context;
  const element = createElement(ownerDocument, "div", { class: "cd-shell-toasts", "data-chrome": "toasts" });
  return {
    element,
    show() {
      return { dismiss() {} };
    },
    setBottom(bottom) {
      element.style.bottom = `${bottom}px`;
    },
    destroy() {
      element.remove();
    },
  };
}
