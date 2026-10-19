import { createElement } from "./element.js";
import { iconElement } from "./icons.js";
import type { StatusMessage } from "./types.js";

export interface StatusBox {
  readonly element: HTMLElement;
  set(status: StatusMessage | null, delayMs: number): void;
  destroy(): void;
}

export function createStatusBox(ownerDocument: Document): StatusBox {
  const icon = createElement(ownerDocument, "span", { class: "cd-shell-status-icon" });
  const text = createElement(ownerDocument, "p", { class: "cd-shell-status-text" });
  const element = createElement(
    ownerDocument,
    "div",
    { class: "cd-shell-status", "data-chrome": "status" },
    icon,
    text,
  );
  element.hidden = true;

  let pending: { status: StatusMessage; timer: ReturnType<typeof setTimeout> } | undefined;

  function cancelPending(): void {
    if (pending) clearTimeout(pending.timer);
    pending = undefined;
  }

  function show(status: StatusMessage): void {
    pending = undefined;
    if (element.dataset.severity !== status.severity) {
      element.dataset.severity = status.severity;
      element.setAttribute("role", status.severity === "danger" ? "alert" : "status");
      icon.replaceChildren(iconElement(status.severity === "danger" ? "circle-x" : "triangle-alert"));
    }
    // An unchanged text is not written again, so role="alert" does not announce it again.
    if (text.textContent !== status.text) text.textContent = status.text;
    element.hidden = false;
  }

  return {
    element,
    set(status, delayMs) {
      if (status === null) {
        cancelPending();
        element.hidden = true;
        return;
      }
      if (!element.hidden) {
        show(status);
        return;
      }
      // Repeated invalid imports while typing keep the first timer: the box shows once the text
      // stayed invalid for the delay, not the delay after the last keystroke (guide §5.12).
      if (pending) {
        pending.status = status;
        return;
      }
      if (delayMs > 0) {
        const entry = { status, timer: setTimeout(() => show(entry.status), delayMs) };
        pending = entry;
      } else {
        show(status);
      }
    },
    destroy() {
      cancelPending();
      element.remove();
    },
  };
}
