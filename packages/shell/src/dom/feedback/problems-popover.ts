import type { ProblemItem, ShellMessages } from "../../core/index.js";
import { createElement } from "../element.js";

export interface ProblemsPopoverContext {
  ownerDocument: Document;
  /** The shell root: outside clicks and the window's blur close the popover, as the menu does. */
  root: HTMLElement;
  /** The shell's layer (40): the popover lives there, like the dropdown. */
  layer: HTMLElement;
  /** The pill, its trigger: gets `aria-haspopup="dialog"`, `aria-expanded` and `aria-controls`. */
  pill: HTMLButtonElement;
  /** `cd-shell-problems-N` on the popover. */
  id: string;
  /** `cd-shell-problems-title-N` on its title. */
  titleId: string;
  messages: ShellMessages;
  onSelectItem?: ((item: ProblemItem) => void) | undefined;
}

export interface ProblemsPopover {
  /** The `<div data-chrome="problems-popover" role="dialog">`. */
  readonly element: HTMLElement;
  isOpen(): boolean;
  /** Open (focus on the first row, else the popover) or close (focus back to the pill). */
  toggle(): void;
  open(): void;
  close(options?: { restoreFocus?: boolean | undefined }): void;
  /** The rows; while open the list re-renders and keeps the focused row. */
  setItems(items: readonly ProblemItem[]): void;
  destroy(): void;
}

/**
 * The web app's problems list (guide §5.10): a popover above the pill, left-aligned with it
 * (`left: 12px`, its bottom 8px above the pill's top), `role="dialog"` without `aria-modal`,
 * `aria-labelledby` its title `messages.problemsTitle` (13px/600); opaque `--cd-ui-flaeche-hoch`,
 * 1px `--cd-ui-linie`, radius `md`, `shadow-3`, `min(320px, 100cqw − 24px)` wide, at most 320px
 * high with a scrolling list; pop-in 150ms from `translateY(4px)`. A row is at least 36px: the 16px
 * icon of the pill (`circle-x` in `--cd-ui-danger`, `triangle-alert` in `--cd-ui-warning`), the
 * message 13px `--cd-ui-text`, below it the location 13px `--cd-ui-text-leise`. Rows with an
 * `elementId` are buttons: a click closes the popover, returns the focus to the canvas and then
 * calls `onSelectItem(item)`; rows without one are text. Escape (the popover's own handler) and
 * Tab out close it with the focus back on the pill; an outside `pointerdown` (capture) and the
 * window's blur close it without moving the focus. The zoom keys keep working (not modal).
 */
export function createProblemsPopover(context: ProblemsPopoverContext): ProblemsPopover {
  // TODO(feedback): rendering, trigger ARIA, focus and closing rules above.
  const { ownerDocument, layer, id, titleId } = context;
  const element = createElement(ownerDocument, "div", {
    class: "cd-shell-problems-popover",
    "data-chrome": "problems-popover",
    role: "dialog",
    id,
    "aria-labelledby": titleId,
  });
  element.hidden = true;
  layer.append(element);
  return {
    element,
    isOpen: () => !element.hidden,
    toggle() {},
    open() {},
    close() {},
    setItems() {},
    destroy() {
      element.remove();
    },
  };
}
