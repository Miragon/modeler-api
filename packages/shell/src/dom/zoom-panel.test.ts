import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chrome, cleanup, fakeZoomTarget, installFakes, mount } from "./test-support.js";

beforeEach(installFakes);
afterEach(cleanup);

function parts(root: HTMLElement) {
  const panel = chrome(root, "zoom");
  const button = (zoom: string) => {
    const element = panel.querySelector<HTMLButtonElement>(`[data-zoom="${zoom}"]`);
    if (!element) throw new Error(zoom);
    return element;
  };
  return { panel, out: button("out"), actual: button("actual"), in: button("in"), fit: button("fit") };
}

describe("zoom panel (guide §5.8)", () => {
  it("is a named group [−][NN%][+] | [Fit]", () => {
    const { root } = mount();
    const { panel, out, actual, fit } = parts(root);
    expect(panel.getAttribute("role")).toBe("group");
    expect(panel.getAttribute("aria-label")).toBe("Zoom");
    expect([...panel.children].map((child) => child.getAttribute("data-zoom") ?? child.className)).toEqual([
      "out",
      "actual",
      "in",
      "cd-shell-zoom-separator",
      "fit",
    ]);
    expect(panel.querySelector(".cd-shell-zoom-separator")?.getAttribute("aria-hidden")).toBe("true");
    expect(out.getAttribute("aria-label")).toBe("Zoom out");
    expect(fit.getAttribute("aria-label")).toBe("Fit to view");
    expect(actual.classList).toContain("cd-shell-zoom-readout");
    expect(out.querySelector("svg")).not.toBeNull();
    expect(actual.querySelector("svg")).toBeNull();
  });

  it.each([
    ["mac", ["Meta+-", "Meta+0", "Meta+= Meta+Plus", "Shift+1"]],
    ["other", ["Control+-", "Control+0", "Control+= Control+Plus", "Shift+1"]],
  ] as const)("carries aria-keyshortcuts for %s", (platform, expected) => {
    const { root } = mount({ platform });
    const { out, actual, in: zoomIn, fit } = parts(root);
    expect([out, actual, zoomIn, fit].map((button) => button.getAttribute("aria-keyshortcuts"))).toEqual(
      expected,
    );
  });

  it("is disabled without a target", () => {
    const { root } = mount();
    const { out, actual, in: zoomIn, fit } = parts(root);
    for (const button of [out, actual, zoomIn, fit])
      expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(actual.textContent).toBe("100%");
    expect(actual.getAttribute("aria-label")).toBe("Zoom to 100% (now 100%)");
  });

  it("reads the zoom once per frame after onChange", () => {
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame", "setTimeout", "clearTimeout"],
    });
    const { shell, root } = mount();
    const target = fakeZoomTarget(0.86);
    shell.setZoomTarget(target);
    const { actual } = parts(root);
    expect(actual.textContent).toBe("86%");
    expect(actual.getAttribute("aria-label")).toBe("Zoom to 100% (now 86%)");
    vi.mocked(target.zoom).mockClear();

    target.change(1.35);
    target.change(1.82);
    target.change(2.46);
    expect(actual.textContent).toBe("86%");
    vi.advanceTimersToNextFrame();
    expect(actual.textContent).toBe("246%");
    expect(vi.mocked(target.zoom)).toHaveBeenCalledTimes(1);
  });

  it("formats the readout in the UI language", () => {
    const { shell, root } = mount({ lang: "de" });
    shell.setZoomTarget(fakeZoomTarget(0.86));
    const { actual } = parts(root);
    expect(actual.textContent).toBe("86 %");
  });

  it("disables zoom out at 20 % and below, zoom in at 400 %, fit without content", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    const { shell, root } = mount();
    const target = fakeZoomTarget(0.2);
    shell.setZoomTarget(target);
    const { out, actual, in: zoomIn, fit } = parts(root);
    expect(out.getAttribute("aria-disabled")).toBe("true");
    expect(zoomIn.hasAttribute("aria-disabled")).toBe(false);
    expect(actual.hasAttribute("aria-disabled")).toBe(false);

    target.change(0.15);
    vi.advanceTimersToNextFrame();
    expect(out.getAttribute("aria-disabled")).toBe("true");
    out.click();
    expect(target.calls).toEqual([]);

    target.change(4);
    vi.advanceTimersToNextFrame();
    expect(out.hasAttribute("aria-disabled")).toBe(false);
    expect(zoomIn.getAttribute("aria-disabled")).toBe("true");
    zoomIn.click();
    expect(target.calls).toEqual([]);

    target.fittable = false;
    target.change();
    vi.advanceTimersToNextFrame();
    expect(fit.getAttribute("aria-disabled")).toBe("true");
    fit.click();
    expect(target.calls).toEqual([]);
  });

  it("steps, goes to 100 % from the readout and fits", () => {
    const { shell, root } = mount();
    const target = fakeZoomTarget(0.86);
    shell.setZoomTarget(target);
    const { out, actual, in: zoomIn, fit } = parts(root);
    zoomIn.click();
    out.click();
    actual.click();
    fit.click();
    expect(target.calls).toEqual(["step:1", "step:-1", "actual", "fit"]);
    target.current = 1;
    actual.click();
    expect(target.calls).toHaveLength(4);
  });

  it("unbinds the previous target", () => {
    const { shell } = mount();
    const first = fakeZoomTarget(1);
    const second = fakeZoomTarget(2);
    shell.setZoomTarget(first);
    shell.setZoomTarget(second);
    expect(first.listeners.size).toBe(0);
    shell.setZoomTarget(null);
    expect(second.listeners.size).toBe(0);
  });
});
