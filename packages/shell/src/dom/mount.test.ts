import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mountShell } from "./mount.js";
import {
  FakeResizeObserver,
  chrome,
  cleanup,
  fakePalette,
  fakeZoomTarget,
  installFakes,
  keydown,
  mount,
  setContainerSize,
} from "../../test/support/dom.js";

beforeEach(installFakes);
afterEach(cleanup);

const fullOptions = {
  menu: { export: [{ kind: "action" as const, id: "png", label: "Export as PNG", onSelect() {} }] },
  problems: { onActivate() {} },
  legend: { render() {} },
  inspector: { label: "Properties" },
  emptyHint: { onInsertExample() {} },
};

describe("mountShell: DOM", () => {
  it("renders the chrome in the tab order of guide §5.14, the layer last", () => {
    const { root } = mount(fullOptions);
    const order = [...root.children].map(
      (child) => child.getAttribute("data-chrome") ?? child.className.split(" ")[0],
    );
    expect(order).toEqual([
      "menu",
      "cd-shell-canvas",
      "status",
      "cd-shell-hint",
      "inspector",
      "problems",
      "legend",
      "zoom",
      "cd-shell-layer",
    ]);
    const layer = root.querySelector(".cd-shell-layer");
    expect([...(layer?.children ?? [])].map((child) => child.getAttribute("role"))).toEqual([
      "menu",
      "tooltip",
    ]);
    expect(root.querySelector('[data-chrome="primary"]')).toBeNull();
  });

  it("gives every island its class and keeps what is not shown hidden", () => {
    const { root } = mount(fullOptions);
    expect(chrome(root, "menu").className).toBe("cd-shell-menu-trigger cd-shell-island");
    expect(chrome(root, "zoom").classList).toContain("cd-shell-zoom");
    expect(chrome(root, "problems").classList).toContain("cd-shell-problems");
    expect(chrome(root, "legend").localName).toBe("section");
    expect(chrome(root, "inspector").localName).toBe("aside");
    expect(chrome(root, "inspector").getAttribute("aria-label")).toBe("Properties");
    expect(chrome(root, "status").classList).toContain("cd-shell-status");
    for (const name of ["status", "inspector", "problems"])
      expect(chrome(root, name).hidden, name).toBe(true);
    expect(root.querySelector<HTMLElement>(".cd-shell-hint")?.hidden).toBe(true);
    expect(root.querySelector<HTMLElement>(".cd-shell-menu")?.hidden).toBe(true);
    expect(root.querySelector<HTMLElement>(".cd-shell-tooltip")?.hidden).toBe(true);
  });

  it("has no positive tabindex and only buttons of type button", () => {
    const { root } = mount(fullOptions);
    const positive = [...root.querySelectorAll("[tabindex]")].filter(
      (element) => Number(element.getAttribute("tabindex")) > 0,
    );
    expect(positive).toEqual([]);
    for (const button of root.querySelectorAll("button")) expect(button.type).toBe("button");
  });

  it("renders only the islands the modeler asked for", () => {
    const { root } = mount();
    expect(root.querySelector('[data-chrome="problems"]')).toBeNull();
    expect(root.querySelector('[data-chrome="legend"]')).toBeNull();
    expect(root.querySelector('[data-chrome="inspector"]')).toBeNull();
    expect(root.querySelector(".cd-shell-hint")).toBeNull();
    expect(chrome(root, "zoom")).toBeTruthy();
    expect(chrome(root, "status")).toBeTruthy();
    // a menu without entries leaves its anchor empty
    expect(chrome(root, "menu").hidden).toBe(true);
  });

  it("moves a passed canvas into the slot and creates one otherwise", () => {
    const canvas = document.createElement("div");
    canvas.className = "djs-parent";
    const { shell, root } = mount({ canvas });
    expect(shell.canvas).toBe(canvas);
    expect(canvas.parentElement).toBe(root);
    expect(canvas.className).toBe("djs-parent cd-shell-canvas");
    expect(root.children[1]).toBe(canvas);

    const { shell: other } = mount();
    expect(other.canvas.className).toBe("cd-shell-canvas");
    expect(other.canvas.parentElement).toBe(other.root);
  });
});

describe("mountShell: root and document", () => {
  it.each(["ide", "web"] as const)(
    "%s: root class, host and palette attributes, own-document class",
    (host) => {
      const { root } = mount({ host });
      expect(root.classList).toContain("cd-shell");
      expect(root.getAttribute("data-cd-shell-host")).toBe(host);
      expect(root.getAttribute("data-palette")).toBe("top");
      expect(root.hasAttribute("lang")).toBe(false);
      expect(document.documentElement.classList).toContain("cd-shell-document");
      for (const name of ["data-legend", "data-inspector", "data-problems", "data-readonly"]) {
        expect(root.hasAttribute(name), name).toBe(false);
      }
    },
  );

  it("embedded: the root carries lang, the foreign page keeps its document", () => {
    document.documentElement.lang = "de";
    const { shell, root } = mount({ host: "embedded", lang: "en" });
    expect(root.getAttribute("lang")).toBe("en");
    expect(shell.lang).toBe("en");
    expect(document.documentElement.classList).not.toContain("cd-shell-document");
  });

  it("embedded: the foreign page's language is not the tool's (guide §2)", () => {
    document.documentElement.lang = "de";
    const page = document.createElement("div");
    page.lang = "de-DE";
    const root = document.createElement("div");
    page.append(root);
    document.body.append(page);
    setContainerSize(root, 1000, 800);
    const english = mountShell(root, { host: "embedded" });
    expect(english.lang).toBe("en");
    expect(root.getAttribute("lang")).toBe("en");
    english.destroy();

    root.setAttribute("lang", "fr");
    const declared = mountShell(root, { host: "embedded" });
    expect(declared.lang).toBe("fr");
    declared.destroy();
    expect(root.getAttribute("lang")).toBe("fr");
  });

  it("reads the language from the closest [lang], else English", () => {
    const wrapper = document.createElement("div");
    wrapper.lang = "de-DE";
    const root = document.createElement("div");
    wrapper.append(root);
    document.body.append(wrapper);
    setContainerSize(root, 1000, 800);
    const german = mountShell(root, { host: "ide" });
    expect(german.lang).toBe("de-DE");
    german.destroy();

    const bare = document.createElement("div");
    document.body.append(bare);
    const english = mountShell(bare, { host: "ide" });
    expect(english.lang).toBe("en");
    english.destroy();
  });

  it("resolves messages and the platform", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    const root = document.createElement("div");
    document.body.append(root);
    const shell = mountShell(root, { host: "ide", messages: { menu: "Menü", keyNames: { ctrl: "Strg" } } });
    expect(shell.platform).toBe("mac");
    expect(shell.messages.menu).toBe("Menü");
    expect(shell.messages.keyNames).toEqual({ ctrl: "Strg", shift: "Shift", plus: "Plus", minus: "Minus" });
    expect(chrome(root, "menu").getAttribute("aria-label")).toBe("Menü");
    shell.destroy();
  });
});

describe("destroy", () => {
  it("removes every element, class, attribute, listener and observer, and is idempotent", () => {
    vi.useFakeTimers();
    const canvas = document.createElement("div");
    const { shell, root } = mount({ ...fullOptions, canvas });
    const target = fakeZoomTarget(1);
    shell.setZoomTarget(target);
    shell.registerPalette(fakePalette());
    shell.setProblems({ count: 2, errors: 1 });
    shell.setReadOnly(true);
    shell.legend?.setOpen(true);
    shell.inspector?.open();
    shell.setStatus({ severity: "danger", text: "Invalid" }, { delayMs: 800 });
    shell.menu.open();
    const observer = FakeResizeObserver.instances[0];

    shell.destroy();
    shell.destroy();

    expect([...root.children]).toEqual([canvas]);
    expect(canvas.className).toBe("");
    expect(root.getAttributeNames()).toEqual(["id"]);
    expect(root.className).toBe("");
    expect(document.documentElement.className).toBe("");
    expect(observer?.disconnected).toBe(true);
    expect(target.listeners.size).toBe(0);

    vi.advanceTimersByTime(2000);
    expect(root.querySelector(".cd-shell-status")).toBeNull();
    expect(keydown(document.body, { key: "=", code: "Equal", metaKey: true }).defaultPrevented).toBe(false);
    expect(target.calls).toEqual([]);
  });

  it("keeps what the page had before the mount", () => {
    document.documentElement.classList.add("cd-shell-document");
    const root = document.createElement("div");
    root.className = "app";
    root.setAttribute("lang", "en");
    document.body.append(root);
    const shell = mountShell(root, { host: "embedded" });
    shell.destroy();
    expect(document.documentElement.classList).toContain("cd-shell-document");
    expect(root.className).toBe("app");
    expect(root.getAttribute("lang")).toBe("en");
  });

  it("turns every later call into a no-op", () => {
    const { shell, root } = mount(fullOptions);
    shell.destroy();
    expect(() => {
      shell.setProblems({ count: 1, errors: 0 });
      shell.setStatus({ severity: "warning", text: "x" });
      shell.setEmptyHint(true);
      shell.setReadOnly(true);
      shell.setZoomTarget(fakeZoomTarget());
      shell.menu.open();
      shell.legend?.toggle();
      shell.inspector?.open();
      shell.registerPalette(fakePalette())();
      shell.tooltip.attach(document.createElement("button"), { label: "x" })();
    }).not.toThrow();
    expect(root.children.length).toBe(0);
    expect(root.hasAttribute("data-readonly")).toBe(false);
  });
});
