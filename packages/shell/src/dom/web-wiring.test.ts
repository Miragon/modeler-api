import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cleanup, installFakes, keydown, mount } from "../../test/support/dom.js";
import type { ShellOptions } from "./types.js";

beforeEach(installFakes);
afterEach(cleanup);

const komet = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E";

/** Every web-column option, as a web app passes them. */
function webOptions(): Partial<ShellOptions> {
  return {
    primary: { onSelect() {} },
    legal: { links: [{ label: "GitHub", href: "https://github.com/Miragon/modeler-api" }] },
    file: { newDiagram: { onSelect() {} }, open: { onSelect() {} } },
    appearance: { themeColors: { light: "#335DE5", dark: "#1D1D1D" } },
    problems: { onActivate() {} },
    emptyState: { title: "Demo", text: "Start.", komet, onNewDiagram() {} },
    dropZone: { accept: [".demo"], onDrop() {} },
  };
}

function chromeNames(root: HTMLElement): string[] {
  return [...root.querySelectorAll("[data-chrome]")].map(
    (element) => element.getAttribute("data-chrome") ?? "",
  );
}

describe("web-column wiring (0.2)", () => {
  it("renders none of the web column in the IDE host, whatever is passed", () => {
    const { shell, root } = mount({ host: "ide", ...webOptions() });
    expect(chromeNames(root)).toEqual(["menu", "status", "problems", "zoom"]);
    expect(shell.primary).toBeUndefined();
    expect(shell.appearance).toBeUndefined();
    expect(shell.isEmptyStateShown()).toBe(false);
    shell.setEmptyState(true);
    expect(root.hasAttribute("data-empty-state")).toBe(false);
    const handle = shell.toast({ status: "success", text: "Link copied" });
    expect(() => handle.dismiss()).not.toThrow();
  });

  it("keeps the embedded host to toasts and, without onActivate, the problems popover", () => {
    const withList = mount({ host: "embedded", ...webOptions(), problems: {} });
    expect(chromeNames(withList.root)).toEqual([
      "menu",
      "status",
      "problems",
      "zoom",
      "problems-popover",
      "toasts",
    ]);
    const withOwnView = mount({ host: "embedded", problems: { onActivate() {} } });
    expect(chromeNames(withOwnView.root)).not.toContain("problems-popover");
  });

  it("puts the web column in the tab order of §5.14", () => {
    const { root } = mount({ host: "web", ...webOptions() });
    expect(chromeNames(root)).toEqual([
      "menu",
      "primary",
      "status",
      "empty-state",
      "problems",
      "legal",
      "zoom",
      "problems-popover",
      "drop-zone",
      "toasts",
    ]);
    const children = [...root.children];
    expect(children.indexOf(root.querySelector('[data-chrome="primary"]')!)).toBe(1);
    expect(children.at(-1)?.getAttribute("data-chrome")).toBe("toasts");
  });

  it("shows the start screen: root state, inert canvas, inert chrome keys", () => {
    const { shell, root } = mount({ host: "web", ...webOptions() });
    const zoom = {
      zoom: () => 1,
      stepZoom: vi.fn(),
      zoomToActual: vi.fn(),
      fit: vi.fn(),
      canFit: () => true,
    };
    shell.setZoomTarget({ ...zoom, onChange: () => () => {} });

    shell.setEmptyState(true);
    expect(shell.isEmptyStateShown()).toBe(true);
    expect(root.getAttribute("data-empty-state")).toBe("shown");
    expect(shell.canvas.hasAttribute("inert")).toBe(true);
    const event = keydown(document.body, { key: "=", code: "Equal", metaKey: true });
    expect(event.defaultPrevented).toBe(true);
    expect(zoom.stepZoom).not.toHaveBeenCalled();

    shell.setEmptyState(false);
    expect(root.hasAttribute("data-empty-state")).toBe(false);
    expect(shell.canvas.hasAttribute("inert")).toBe(false);
    keydown(document.body, { key: "=", code: "Equal", metaKey: true });
    expect(zoom.stepZoom).toHaveBeenCalledTimes(1);
  });

  it("offers shell.appearance to a dark-capable web modeler only", () => {
    expect(mount({ host: "web", ...webOptions() }).shell.appearance).toBeUndefined();
    expect(mount({ host: "web", ...webOptions(), themes: ["light", "dark"] }).shell.appearance).toBeDefined();
  });

  it("removes the web column and the canvas's inert again on destroy", () => {
    const { shell, root } = mount({ host: "web", ...webOptions() });
    shell.setEmptyState(true);
    shell.destroy();
    expect(chromeNames(root)).toEqual([]);
    expect(root.attributes.length).toBe(1); // id="app"
    expect(shell.canvas.hasAttribute("inert")).toBe(false);
  });
});
