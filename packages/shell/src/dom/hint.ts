import type { Insets, ShellMessages } from "../core/index.js";
import { createElement } from "./element.js";
import type { EmptyHintOptions } from "./types.js";

export interface EmptyHint {
  readonly element: HTMLElement;
  isShown(): boolean;
  setShown(shown: boolean): void;
  /** Centres the hint in the free rectangle of the fit (guide §13.5). */
  place(insets: Insets): void;
  destroy(): void;
}

export function createEmptyHint(
  ownerDocument: Document,
  messages: ShellMessages,
  options: EmptyHintOptions,
): EmptyHint {
  const { onInsertExample } = options;
  const action = onInsertExample
    ? createElement(
        ownerDocument,
        "button",
        { type: "button", class: "cd-shell-hint-action" },
        messages.insertExample,
      )
    : undefined;
  action?.addEventListener("click", () => onInsertExample?.());
  const element = createElement(
    ownerDocument,
    "div",
    { class: "cd-shell-hint" },
    createElement(ownerDocument, "p", { class: "cd-shell-hint-text" }, messages.emptyHint),
    action,
  );
  element.hidden = true;

  return {
    element,
    isShown: () => !element.hidden,
    setShown(shown) {
      element.hidden = !shown;
    },
    place({ top, right, bottom, left }) {
      element.style.inset = `${top}px ${right}px ${bottom}px ${left}px`;
    },
    destroy() {
      element.remove();
    },
  };
}
