import type { ShellMessages } from "../../core/index.js";
import { createElement } from "../element.js";
import type { EmptyStateOptions } from "../types.js";

export interface EmptyStateContext {
  ownerDocument: Document;
  messages: ShellMessages;
  options: EmptyStateOptions;
  /** The drop hint under the buttons; `undefined` without a drop zone. */
  dropHint: string | undefined;
  /** `id` of the title, the section's `aria-labelledby`. */
  titleId: string;
  /** Runs before `onNewDiagram` / `onShowExample`: the shell hides the card and moves the focus. */
  onLeave(): void;
}

export interface EmptyStateController {
  /** The `<section data-chrome="empty-state">`. */
  readonly element: HTMLElement;
  isShown(): boolean;
  setShown(shown: boolean): void;
  destroy(): void;
}

/**
 * `<section class="cd-shell-empty-state" data-chrome="empty-state" aria-labelledby>` (guide §8):
 * centred in the container, `min(400px, 100cqw − 24px)` wide, glass, `shadow-2`, radius `lg`,
 * padding `32px 40px`, content centred with 16px gaps: `<img src=komet width=64 height=64
 * alt="">`, `<h1>` title 21px/600, help 16px/1.6 `--cd-ui-text-leise`, then the buttons side by
 * side with 8px gap, 36px high (`cd-shell-button`): primary "New diagram" first, ghost "Show
 * example", then the drop hint 13px `--cd-ui-text-leise`. Layer 20, `hidden` until `setShown(true)`.
 */
export function createEmptyState(context: EmptyStateContext): EmptyStateController {
  // TODO(web-chrome): the card above; each button calls context.onLeave() first.
  const { ownerDocument, titleId } = context;
  const element = createElement(ownerDocument, "section", {
    class: "cd-shell-empty-state",
    "data-chrome": "empty-state",
    "aria-labelledby": titleId,
  });
  element.hidden = true;
  return {
    element,
    isShown: () => !element.hidden,
    setShown(shown) {
      element.hidden = !shown;
    },
    destroy() {
      element.remove();
    },
  };
}
