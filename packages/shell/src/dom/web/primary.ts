import { SHELL, type PrimaryWidths, type ShellMessages } from "../../core/index.js";
import { createElement } from "../element.js";
import { iconElement } from "../icons.js";
import type { TooltipController } from "../tooltip.js";
import type { PrimaryActionHandle, PrimaryActionOptions } from "../types.js";

export interface PrimaryActionContext {
  ownerDocument: Document;
  messages: ShellMessages;
  tooltip: TooltipController;
  options: PrimaryActionOptions;
}

export interface PrimaryActionController extends PrimaryActionHandle {
  /**
   * Border-box widths with and without the label for `decideTopRow`, measured also while the label
   * is collapsed (the label's width does not change with the state), cached until `refresh()`.
   */
  widths(): PrimaryWidths;
  /** Icon only (`true`) or icon and label; the `aria-label` stays, the tooltip shows only while collapsed. */
  setCollapsed(collapsed: boolean): void;
  destroy(): void;
}

/**
 * `<button type="button" class="cd-shell-primary cd-shell-button" data-variant="primary"
 * data-chrome="primary" aria-label="Share">` with the 16px icon and `<span
 * class="cd-shell-primary-label">` (guide §5.7): 40px high at `top: 12px; right: 12px`, layer 30,
 * blue (`dom/buttons.css`), hover lift. Collapsed: 40 × 40, label hidden, chrome tooltip with the
 * label (no `aria-describedby`, it repeats the name). `disabled()` → `aria-disabled`, no action.
 */
export function createPrimaryAction(context: PrimaryActionContext): PrimaryActionController {
  // TODO(web-chrome): tooltip while collapsed, aria-disabled, label width measured while collapsed.
  const { ownerDocument, messages, options } = context;
  const label = options.label ?? messages.share;
  const element = createElement(
    ownerDocument,
    "button",
    {
      type: "button",
      class: "cd-shell-primary cd-shell-button",
      "data-variant": "primary",
      "data-chrome": "primary",
      "aria-label": label,
    },
    iconElement(options.icon ?? "share-2"),
    createElement(ownerDocument, "span", { class: "cd-shell-primary-label" }, label),
  );
  element.addEventListener("click", () => options.onSelect());
  let collapsed = false;
  return {
    element,
    isCollapsed: () => collapsed,
    refresh() {},
    widths: () => ({ withLabel: element.offsetWidth, iconOnly: SHELL.row }),
    setCollapsed(next) {
      collapsed = next;
    },
    destroy() {
      element.remove();
    },
  };
}
