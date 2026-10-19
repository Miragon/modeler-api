import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TOOLTIP_DELAY_MS } from "../core/index.js";
import {
  chrome,
  cleanup,
  fakePalette,
  fakeZoomTarget,
  installFakes,
  keydown,
  mount,
  pointer,
  setBox,
} from "../../test/support/dom.js";

beforeEach(() => {
  installFakes();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
});
afterEach(cleanup);

function tooltipOf(root: HTMLElement): HTMLElement {
  const element = root.querySelector<HTMLElement>(".cd-shell-tooltip");
  if (!element) throw new Error("no tooltip");
  return element;
}

function zoomButton(root: HTMLElement, zoom: string): HTMLButtonElement {
  const button = chrome(root, "zoom").querySelector<HTMLButtonElement>(`[data-zoom="${zoom}"]`);
  if (!button) throw new Error(zoom);
  return button;
}

describe("chrome tooltip (guide §5.6)", () => {
  it("shows after 300ms hover with the shortcut chip", () => {
    const { shell, root } = mount({ platform: "mac" });
    shell.setZoomTarget(fakeZoomTarget(1));
    const tooltip = tooltipOf(root);
    expect(tooltip.getAttribute("role")).toBe("tooltip");
    const zoomIn = zoomButton(root, "in");
    pointer(zoomIn, "pointerenter");
    vi.advanceTimersByTime(TOOLTIP_DELAY_MS - 1);
    expect(tooltip.hidden).toBe(true);
    vi.advanceTimersByTime(1);
    expect(tooltip.hidden).toBe(false);
    expect(tooltip.querySelector(".cd-shell-tooltip-label")?.textContent).toBe("Zoom in");
    expect(tooltip.querySelector("kbd.cd-shell-kbd")?.textContent).toBe("⌘+");
    expect(tooltip.parentElement?.classList).toContain("cd-shell-layer");
  });

  it("labels shortcuts for the platform", () => {
    const { root } = mount({ platform: "other" });
    zoomButton(root, "out").focus();
    expect(tooltipOf(root).querySelector("kbd")?.textContent).toBe("Ctrl+Minus");
    zoomButton(root, "fit").focus();
    expect(tooltipOf(root).querySelector("kbd")?.textContent).toBe("Shift+1");
    zoomButton(root, "actual").focus();
    expect(tooltipOf(root).querySelector(".cd-shell-tooltip-label")?.textContent).toBe("Zoom to 100%");
  });

  it("shows at once on keyboard focus, also on a disabled button, and hides on blur", () => {
    const { root } = mount();
    const zoomOut = zoomButton(root, "out");
    expect(zoomOut.getAttribute("aria-disabled")).toBe("true");
    zoomOut.focus();
    expect(tooltipOf(root).hidden).toBe(false);
    zoomOut.blur();
    expect(tooltipOf(root).hidden).toBe(true);
  });

  it("shows a neighbour at once while one is shown or just was", () => {
    const { root } = mount();
    const tooltip = tooltipOf(root);
    pointer(zoomButton(root, "out"), "pointerenter");
    vi.advanceTimersByTime(TOOLTIP_DELAY_MS);
    pointer(zoomButton(root, "out"), "pointerleave");
    expect(tooltip.hidden).toBe(true);
    pointer(zoomButton(root, "in"), "pointerenter");
    expect(tooltip.hidden).toBe(false);
    expect(tooltip.textContent).toContain("Zoom in");

    pointer(zoomButton(root, "in"), "pointerleave");
    vi.advanceTimersByTime(TOOLTIP_DELAY_MS + 1);
    pointer(zoomButton(root, "fit"), "pointerenter");
    expect(tooltip.hidden).toBe(true);
  });

  it("hides on click until the pointer leaves, on Escape and on leave", () => {
    const { shell, root } = mount();
    shell.setZoomTarget(fakeZoomTarget(1));
    const tooltip = tooltipOf(root);
    const zoomIn = zoomButton(root, "in");
    pointer(zoomIn, "pointerenter");
    vi.advanceTimersByTime(TOOLTIP_DELAY_MS);
    pointer(zoomIn, "pointerdown");
    zoomIn.click();
    expect(tooltip.hidden).toBe(true);
    pointer(zoomIn, "pointerenter");
    vi.advanceTimersByTime(TOOLTIP_DELAY_MS);
    expect(tooltip.hidden).toBe(true);
    pointer(zoomIn, "pointerleave");
    pointer(zoomIn, "pointerenter");
    vi.advanceTimersByTime(TOOLTIP_DELAY_MS);
    expect(tooltip.hidden).toBe(false);

    keydown(zoomIn, { key: "Escape" });
    expect(tooltip.hidden).toBe(true);

    pointer(zoomIn, "pointerleave");
    pointer(zoomIn, "pointerenter");
    vi.advanceTimersByTime(TOOLTIP_DELAY_MS);
    pointer(zoomIn, "pointerleave");
    expect(tooltip.hidden).toBe(true);
  });

  it("hides when the menu opens and is suppressed on the open trigger", () => {
    const { shell, root } = mount({
      menu: { export: [{ kind: "action", id: "png", label: "Export as PNG", onSelect() {} }] },
    });
    const tooltip = tooltipOf(root);
    shell.menu.trigger.focus();
    expect(tooltip.hidden).toBe(false);
    expect(tooltip.textContent).toBe("Menu");
    shell.menu.open();
    expect(tooltip.hidden).toBe(true);
    pointer(shell.menu.trigger, "pointerenter");
    vi.advanceTimersByTime(TOOLTIP_DELAY_MS);
    expect(tooltip.hidden).toBe(true);
  });

  it("never shows on touch", () => {
    const { root } = mount();
    pointer(zoomButton(root, "in"), "pointerenter", { pointerType: "touch" });
    vi.advanceTimersByTime(TOOLTIP_DELAY_MS * 2);
    expect(tooltipOf(root).hidden).toBe(true);
  });

  it("is placed by placeTooltip in shell-root coordinates", () => {
    const { root } = mount({}, { width: 1000, height: 800 });
    const zoom = chrome(root, "zoom");
    setBox(zoom, { left: 815, top: 748, width: 173, height: 40 });
    const zoomIn = zoomButton(root, "in");
    setBox(zoomIn, { left: 911, top: 752, width: 32, height: 32 });
    const tooltip = tooltipOf(root);
    Object.defineProperty(tooltip, "offsetWidth", { configurable: true, value: 100 });
    Object.defineProperty(tooltip, "offsetHeight", { configurable: true, value: 28 });
    zoomIn.focus();
    expect(tooltip.style.left).toBe("877px");
    expect(tooltip.style.top).toBe(`${748 - 8 - 28}px`);
  });

  it("describes a control only when it says more than the control's name", () => {
    const { shell, root } = mount({ problems: { onActivate() {} } });
    shell.setProblems({ count: 2, errors: 1 });
    const pill = chrome(root, "problems");
    pill.focus();
    expect(tooltipOf(root).textContent).toBe("Show in Problems view");
    expect(pill.getAttribute("aria-describedby")).toBe(tooltipOf(root).id);
    pill.blur();
    expect(pill.hasAttribute("aria-describedby")).toBe(false);
    zoomButton(root, "in").focus();
    expect(zoomButton(root, "in").hasAttribute("aria-describedby")).toBe(false);
  });

  it("describes a control whose shortcut chip is not named in aria-keyshortcuts", () => {
    const { shell, root } = mount();
    const named = document.createElement("button");
    named.setAttribute("aria-label", "Lasso");
    named.setAttribute("aria-keyshortcuts", "L");
    const unnamed = document.createElement("button");
    unnamed.setAttribute("aria-label", "Hand");
    root.append(named, unnamed);
    shell.tooltip.attach(named, { label: "Lasso", shortcut: "L" });
    shell.tooltip.attach(unnamed, { label: "Hand", shortcut: "H" });
    const tooltipId = root.querySelector(".cd-shell-tooltip")?.id ?? "";

    pointer(named, "pointerenter");
    vi.advanceTimersByTime(TOOLTIP_DELAY_MS);
    expect(named.hasAttribute("aria-describedby")).toBe(false);
    pointer(named, "pointerleave");

    pointer(unnamed, "pointerenter");
    vi.advanceTimersByTime(TOOLTIP_DELAY_MS);
    expect(unnamed.getAttribute("aria-describedby")).toBe(tooltipId);
  });

  it("attach() works for modeler controls and detaches", () => {
    const { shell, root } = mount();
    const button = root.appendChild(document.createElement("button"));
    let label = "Dynamic";
    const detach = shell.tooltip.attach(button, () => ({ label }));
    button.focus();
    expect(tooltipOf(root).textContent).toBe("Dynamic");
    shell.tooltip.hide();
    expect(tooltipOf(root).hidden).toBe(true);
    label = "Again";
    button.blur();
    button.focus();
    expect(tooltipOf(root).textContent).toBe("Again");
    detach();
    expect(tooltipOf(root).hidden).toBe(true);
    button.blur();
    button.focus();
    expect(tooltipOf(root).hidden).toBe(true);
  });

  it("delegates the palette entries through registerPalette", () => {
    const { shell, root } = mount();
    const palette = fakePalette();
    const lasso = palette.entry("lasso-tool", { label: "Lasso", shortcut: "L" });
    const hand = palette.entry("hand-tool", { label: "Hand", shortcut: "H" });
    const silent = palette.entry("separator", null);
    root.querySelector(".cd-shell-canvas")?.append(palette.element);
    const unregister = shell.registerPalette(palette);
    const tooltip = tooltipOf(root);

    pointer(lasso, "pointerover");
    vi.advanceTimersByTime(TOOLTIP_DELAY_MS);
    expect(tooltip.textContent).toBe("LassoL");
    pointer(lasso, "pointerout", { relatedTarget: hand });
    pointer(hand, "pointerover");
    expect(tooltip.hidden).toBe(false);
    expect(tooltip.textContent).toBe("HandH");

    hand.click();
    expect(tooltip.hidden).toBe(true);

    silent.focus();
    expect(tooltip.hidden).toBe(true);
    lasso.focus();
    expect(tooltip.textContent).toBe("LassoL");

    unregister();
    expect(tooltip.hidden).toBe(true);
    hand.focus();
    expect(tooltip.hidden).toBe(true);
  });
});
