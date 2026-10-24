import {
  ariaKeyShortcuts,
  canZoomIn,
  canZoomOut,
  formatPercent,
  shortcutLabel,
  zoomReadout,
  type ChromeKey,
  type Platform,
  type ShellMessages,
  type ZoomTarget,
} from "../core/index.js";
import { createElement, isPointerClick, toggleAttribute } from "./element.js";
import { iconElement, type ShellIconName } from "./icons.js";
import type { TooltipController } from "./tooltip.js";

export interface ZoomPanelContext {
  ownerDocument: Document;
  messages: ShellMessages;
  lang: string;
  platform: Platform;
  tooltip: TooltipController;
  /** After a pointer click on a button: hands the focus to the canvas (guide §5.8). */
  focusCanvas(): void;
}

export interface ZoomPanel {
  readonly element: HTMLElement;
  setTarget(target: ZoomTarget | null): void;
  /** Runs a chrome key on the bound target; zoom out never zooms in (guide §5.8). */
  run(key: ChromeKey): void;
  destroy(): void;
}

export function createZoomPanel(context: ZoomPanelContext): ZoomPanel {
  const { ownerDocument, messages, lang, platform, tooltip, focusCanvas } = context;
  let target: ZoomTarget | null = null;
  let unsubscribe: (() => void) | undefined;
  let frame: number | undefined;
  const detachers: (() => void)[] = [];

  function button(
    zoom: "out" | "actual" | "in" | "fit",
    key: ChromeKey,
    tooltipLabel: string,
    options: { label?: string; icon?: ShellIconName; className?: string },
  ): HTMLButtonElement {
    const element = createElement(ownerDocument, "button", {
      type: "button",
      class: options.className ?? "cd-shell-target",
      "data-zoom": zoom,
      "aria-label": options.label,
      "aria-keyshortcuts": ariaKeyShortcuts(key, platform),
    });
    if (options.icon) element.append(iconElement(options.icon));
    element.addEventListener("click", (event) => {
      run(key);
      // Enter and Space leave a keyboard user on the button, so the next press zooms again.
      if (isPointerClick(event)) focusCanvas();
    });
    detachers.push(
      tooltip.attach(element, {
        label: tooltipLabel,
        shortcut: shortcutLabel(key, platform, messages.keyNames),
      }),
    );
    return element;
  }

  const zoomOut = button("out", "zoomOut", messages.zoomOut, {
    label: messages.zoomOut,
    icon: "minus",
  });
  const readout = button("actual", "zoomToActual", messages.zoomToActual(formatPercent(1, lang)), {
    className: "cd-shell-target cd-shell-zoom-readout",
  });
  const zoomIn = button("in", "zoomIn", messages.zoomIn, { label: messages.zoomIn, icon: "plus" });
  const fit = button("fit", "fit", messages.fit, { label: messages.fit, icon: "maximize" });
  const separator = createElement(ownerDocument, "span", {
    class: "cd-shell-zoom-separator",
    "aria-hidden": "true",
  });

  const element = createElement(
    ownerDocument,
    "div",
    {
      class: "cd-shell-zoom cd-shell-island",
      "data-chrome": "zoom",
      role: "group",
      "aria-label": messages.zoom,
    },
    zoomOut,
    readout,
    zoomIn,
    separator,
    fit,
  );

  function render(): void {
    frame = undefined;
    const zoom = target?.zoom() ?? 1;
    const state = zoomReadout(zoom, lang, messages);
    if (readout.textContent !== state.text) readout.textContent = state.text;
    readout.setAttribute("aria-label", state.ariaLabel);
    // aria-disabled, not disabled: a button pressed up to the limit keeps the focus (guide §5.8).
    toggleAttribute(zoomOut, "aria-disabled", (!target || !state.canZoomOut) && "true");
    toggleAttribute(zoomIn, "aria-disabled", (!target || !state.canZoomIn) && "true");
    toggleAttribute(fit, "aria-disabled", (!target || !target.canFit()) && "true");
    // The readout is never disabled (guide §5.8); without a target its click does nothing.
  }

  function schedule(): void {
    if (frame === undefined) frame = requestAnimationFrame(render);
  }

  function cancelFrame(): void {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
  }

  function run(key: ChromeKey): void {
    if (!target) return;
    const zoom = target.zoom();
    switch (key) {
      case "zoomIn":
        if (canZoomIn(zoom)) target.stepZoom(1);
        break;
      case "zoomOut":
        if (canZoomOut(zoom)) target.stepZoom(-1);
        break;
      case "zoomToActual":
        if (zoom !== 1) target.zoomToActual();
        break;
      case "fit":
        if (target.canFit()) target.fit();
        break;
    }
  }

  render();

  return {
    element,
    run,
    setTarget(next) {
      unsubscribe?.();
      unsubscribe = undefined;
      cancelFrame();
      target = next;
      if (next) unsubscribe = next.onChange(schedule);
      render();
    },
    destroy() {
      unsubscribe?.();
      unsubscribe = undefined;
      cancelFrame();
      target = null;
      for (const detach of detachers) detach();
      element.remove();
    },
  };
}
