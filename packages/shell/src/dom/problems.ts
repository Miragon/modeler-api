import { formatNumber, type ShellMessages } from "../core/index.js";
import { createElement } from "./element.js";
import { iconElement } from "./icons.js";
import type { TooltipController } from "./tooltip.js";
import type { ProblemSummary } from "./types.js";

export interface ProblemsPill {
  readonly element: HTMLButtonElement;
  isShown(): boolean;
  set(summary: ProblemSummary): void;
  destroy(): void;
}

export interface ProblemsContext {
  ownerDocument: Document;
  messages: ShellMessages;
  lang: string;
  tooltip: TooltipController;
  /** The IDE host opens its Problems view, so only there the pill explains itself. */
  showTooltip: boolean;
  /** A click: `ProblemsOptions.onActivate` (IDE host) or the problems popover's toggle (web host). */
  onActivate(): void;
}

export function createProblemsPill(context: ProblemsContext): ProblemsPill {
  const { ownerDocument, messages, lang, tooltip } = context;
  const icon = createElement(ownerDocument, "span", { class: "cd-shell-problems-icon" });
  const text = createElement(ownerDocument, "span", { class: "cd-shell-problems-text" });
  const element = createElement(
    ownerDocument,
    "button",
    { type: "button", class: "cd-shell-problems cd-shell-island", "data-chrome": "problems" },
    icon,
    text,
  );
  element.hidden = true;
  element.addEventListener("click", () => context.onActivate());
  const detachTooltip = context.showTooltip
    ? tooltip.attach(element, { label: messages.showProblems })
    : undefined;

  let severity: "danger" | "warning" | undefined;

  return {
    element,
    isShown: () => !element.hidden,
    set({ count, errors }) {
      const shown = count > 0;
      element.hidden = !shown;
      if (!shown) {
        tooltip.hide();
        return;
      }
      const formattedCount = formatNumber(count, lang);
      text.textContent = messages.problems(count, formattedCount);
      element.setAttribute(
        "aria-label",
        messages.problemsLabel(count, errors, formattedCount, formatNumber(errors, lang)),
      );
      // The shape carries the severity as well, colour is never the only signal (guide §5.10).
      const next = errors > 0 ? "danger" : "warning";
      if (next !== severity) {
        severity = next;
        element.dataset.severity = next;
        icon.replaceChildren(iconElement(next === "danger" ? "circle-x" : "triangle-alert"));
      }
    },
    destroy() {
      detachTooltip?.();
      element.remove();
    },
  };
}
