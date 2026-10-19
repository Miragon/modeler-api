import type { ShellMessages } from "../core/index.js";
import { createElement } from "./element.js";
import { iconElement } from "./icons.js";
import type { TooltipController } from "./tooltip.js";
import type { LegendHandle, LegendOptions } from "./types.js";

export interface LegendController extends LegendHandle {
  /** The start state once the container height is known; never reported through `onToggle`. */
  start(open: boolean): void;
  isStarted(): boolean;
  destroy(): void;
}

export interface LegendContext {
  ownerDocument: Document;
  messages: ShellMessages;
  tooltip: TooltipController;
  titleId: string;
  options: LegendOptions;
  onChange(open: boolean): void;
  /** Where the focus goes when the close button hides the legend under it. */
  focusAfterClose(): void;
}

export function createLegend(context: LegendContext): LegendController {
  const { ownerDocument, messages, tooltip, titleId, options } = context;
  const close = createElement(ownerDocument, "button", {
    type: "button",
    class: "cd-shell-legend-close",
    "aria-label": messages.closeLegend,
  });
  close.append(iconElement("x"));
  const body = createElement(ownerDocument, "div", { class: "cd-shell-legend-body" });
  const element = createElement(
    ownerDocument,
    "section",
    { class: "cd-shell-legend cd-shell-island", "data-chrome": "legend", "aria-labelledby": titleId },
    createElement(
      ownerDocument,
      "div",
      { class: "cd-shell-legend-header" },
      createElement(ownerDocument, "div", { class: "cd-shell-legend-title", id: titleId }, messages.legend),
      close,
    ),
    body,
  );
  element.hidden = true;
  options.render(body);

  let open = false;
  let started = false;
  const detachTooltip = tooltip.attach(close, { label: messages.closeLegend });

  function apply(next: boolean): boolean {
    started = true;
    if (next === open) return false;
    open = next;
    element.hidden = !open;
    if (!open && element.contains(ownerDocument.activeElement)) context.focusAfterClose();
    context.onChange(open);
    return true;
  }

  function setOpen(next: boolean): void {
    if (apply(next)) options.onToggle?.(next);
  }

  close.addEventListener("click", () => setOpen(false));

  return {
    element,
    body,
    isOpen: () => open,
    setOpen,
    toggle: () => setOpen(!open),
    start(initial) {
      if (!started) apply(initial);
    },
    isStarted: () => started,
    destroy() {
      detachTooltip();
      element.remove();
    },
  };
}
