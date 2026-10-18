import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ariaProbe,
  appearanceProbe,
  menuProbe,
  paletteFocusProbe,
  zoomButtonsProbe,
  MODE_ROLES,
} from "./facts.js";
import { measureChrome } from "./geometry.js";
import type { PageLike } from "./page.js";
import {
  afterPressProbe,
  armCleanupProbe,
  canvasHandlesProbe,
  clearKeysProbe,
  findOverlay,
  findTarget,
  focusTarget,
  inPage,
  injectProbe,
  leftoverProbe,
  removeInjectedProbe,
  settle,
} from "./page-tools.js";

/**
 * Evaluates like Playwright does: the function is rebuilt from its source text, so a probe that
 * reaches outside its own body fails here as it would in the browser. The arg is cloned.
 */
function serializingPage(): PageLike & { evaluated: number } {
  const page = {
    evaluated: 0,
    async evaluate<R, Arg>(pageFunction: (arg: Arg) => R | Promise<R>, arg: Arg): Promise<R> {
      page.evaluated += 1;
      const rebuilt = new Function(`return (${pageFunction.toString()});`)() as (arg: Arg) => R | Promise<R>;
      return structuredClone(await rebuilt(structuredClone(arg)));
    },
    async setViewportSize() {},
    keyboard: { async press() {} },
    mouse: { async click() {}, async move() {} },
    async waitForTimeout() {},
  };
  return page;
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    x: left,
    y: top,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect;
}

function place(element: Element, left: number, top: number, width: number, height: number): void {
  element.getBoundingClientRect = () => rect(left, top, width, height);
}

/** A shell root at (40, 40) with a 1px border, as the demo's embedded host is. */
function buildShell(): HTMLElement {
  document.documentElement.lang = "en";
  document.body.innerHTML = `
    <div class="cd-shell" data-palette="second-row" data-legend="open" data-problems="shown" style="border: 1px solid">
      <button data-chrome="menu" aria-label="Menu" aria-haspopup="menu" aria-expanded="false" aria-controls="m1"></button>
      <div class="cd-shell-canvas"><div class="djs-container">
        <div class="djs-palette" data-chrome="palette">
          <div class="djs-palette-entries" role="toolbar" aria-label="Tools">
            <div class="group" data-group="tools">
              <div class="entry" data-action="lasso-tool" role="button" aria-label="Lasso" tabindex="0" aria-pressed="false"></div>
              <div class="entry" data-action="hand-tool" role="button" aria-label="Hand" tabindex="-1" aria-pressed="false"></div>
            </div>
          </div>
        </div>
        <svg tabindex="0"></svg>
      </div></div>
      <div data-chrome="status" role="alert" data-severity="danger" hidden>Invalid</div>
      <button data-chrome="problems" aria-label="2 problems, 1 error">2 problems</button>
      <section data-chrome="legend" aria-labelledby="t1"><h2 id="t1">Legend</h2><button aria-label="Close legend"></button></section>
      <div data-chrome="zoom" role="group" aria-label="Zoom">
        <button data-zoom="out" aria-label="Zoom out"></button>
        <button data-zoom="actual" aria-label="Zoom to 100% (now 86%)">86%</button>
        <button data-zoom="in" aria-label="Zoom in"></button>
        <button data-zoom="fit" aria-label="Fit to view"></button>
      </div>
      <div data-chrome="unknown"></div>
      <div class="cd-shell-layer">
        <div id="m1" role="menu" aria-label="Menu">
          <div role="group" aria-label="Level"><div role="menuitemradio" aria-checked="true">Big picture</div></div>
          <div role="menuitem">Export as PNG</div>
        </div>
      </div>
    </div>`;
  const root = document.querySelector<HTMLElement>(".cd-shell")!;
  place(root, 40, 40, 722, 702);
  const at = (selector: string, left: number, top: number, width: number, height: number) =>
    place(root.querySelector(selector)!, 41 + left, 41 + top, width, height);
  at('[data-chrome="menu"]', 12, 12, 40, 40);
  at('[data-chrome="palette"]', 280, 64, 160, 40);
  at('[data-action="lasso-tool"]', 284, 68, 32, 32);
  at('[data-action="hand-tool"]', 318, 68, 32, 32);
  at('[data-chrome="status"]', 160, 116, 400, 48);
  at('[data-chrome="problems"]', 12, 648, 120, 40);
  at('[data-chrome="legend"]', 12, 500, 200, 140);
  at('[data-chrome="zoom"]', 535, 648, 173, 40);
  at('[data-zoom="in"]', 630, 652, 32, 32);
  at('[data-chrome="unknown"]', 0, 0, 10, 10);
  at('[role="menu"]', 12, 60, 248, 200);
  for (const selector of [
    '[role="menuitemradio"]',
    '[role="menuitem"]',
    '[data-zoom="out"]',
    '[data-zoom="actual"]',
    '[data-zoom="fit"]',
    ".djs-container",
    "svg",
  ]) {
    at(selector, 0, 0, 10, 10);
  }
  return root;
}

describe("probes in a page", () => {
  let page: ReturnType<typeof serializingPage>;
  const checkVisibility = Element.prototype.checkVisibility;

  beforeEach(() => {
    delete (window as { __modelerShellConformance?: unknown }).__modelerShellConformance;
    // happy-dom has no layout, so its checkVisibility ignores `hidden`; the probes fall back to the DOM walk
    Object.defineProperty(Element.prototype, "checkVisibility", { value: undefined, configurable: true });
    page = serializingPage();
  });

  afterEach(() => {
    Object.defineProperty(Element.prototype, "checkVisibility", {
      value: checkVisibility,
      configurable: true,
    });
    document.body.innerHTML = "";
  });

  it("measures the visible islands relative to the root's padding box", async () => {
    buildShell();
    await expect(measureChrome(page)).resolves.toEqual({
      container: { width: 720, height: 700 },
      paletteRow: "second-row",
      open: { legend: true, inspector: false, problems: true },
      islands: {
        menu: { left: 12, top: 12, width: 40, height: 40 },
        palette: { left: 280, top: 64, width: 160, height: 40 },
        problems: { left: 12, top: 648, width: 120, height: 40 },
        legend: { left: 12, top: 500, width: 200, height: 140 },
        zoom: { left: 535, top: 648, width: 173, height: 40 },
      },
    });
  });

  it("rejects a missing root and duplicated islands", async () => {
    await expect(measureChrome(page, ".nothing")).rejects.toThrow(
      'no element matches the shell root selector ".nothing"',
    );
    const root = buildShell();
    const copy = root.querySelector('[data-chrome="zoom"]')!.cloneNode() as HTMLElement;
    place(copy, 10, 10, 10, 10);
    root.append(copy);
    await expect(measureChrome(page)).rejects.toThrow('more than one visible [data-chrome="zoom"]');
  });

  it("finds, focuses and reads controls", async () => {
    buildShell();
    await expect(findTarget(page, ".cd-shell", "zoom-in")).resolves.toEqual({
      client: { x: 41 + 630 + 16, y: 41 + 652 + 16 },
      box: { left: 630, top: 652, width: 32, height: 32 },
      label: "Zoom in",
    });
    await expect(focusTarget(page, ".cd-shell", "palette-tab-stop")).resolves.toBe("div.entry");
    await expect(inPage(page, paletteFocusProbe, { root: ".cd-shell" })).resolves.toEqual({
      entries: ["lasso-tool", "hand-tool"],
      tabStops: ["lasso-tool"],
      active: "lasso-tool",
    });
    await expect(findOverlay(page, ".cd-shell", "menu")).resolves.toMatchObject({
      box: { left: 12, top: 60, width: 248, height: 200 },
      count: 1,
      id: "m1",
    });
    await expect(findOverlay(page, ".cd-shell", "tooltip")).resolves.toBeNull();
    const zoomButtons = await inPage(page, zoomButtonsProbe, { root: ".cd-shell" });
    expect(Object.keys(zoomButtons)).toEqual(["out", "actual", "in", "fit"]);
  });

  it("records keys on document and window, without modifiers, and reads the readout", async () => {
    buildShell();
    // registered before the kit's recorders, like the shell's own document listener
    const stopMinus = (event: Event) => {
      if ((event as KeyboardEvent).key !== "-") return;
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener("keydown", stopMinus);
    await settle(page);
    await inPage(page, clearKeysProbe, null);
    for (const [key, code] of [
      ["Control", "ControlLeft"],
      ["=", "Equal"],
      ["-", "Minus"],
    ] as const) {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { key, code, ctrlKey: true, bubbles: true, cancelable: true }),
      );
    }
    const facts = await inPage(page, afterPressProbe, { root: ".cd-shell" });
    document.removeEventListener("keydown", stopMinus);
    expect(facts.zoom).toBe(86);
    expect(facts.keys).toEqual([
      {
        key: "=",
        code: "Equal",
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        defaultPrevented: false,
      },
    ]);
    expect(facts.documentKeys.map((key) => [key.key, key.defaultPrevented])).toEqual([
      ["=", false],
      ["-", true],
    ]);
    await expect(inPage(page, afterPressProbe, { root: ".cd-shell" })).resolves.toEqual({
      zoom: 86,
      keys: [],
      documentKeys: [],
    });
  });

  it("injects stand-ins and canvas bindings and removes them again", async () => {
    const root = buildShell();
    await expect(inPage(page, injectProbe, { root: ".cd-shell", kind: "modal" })).resolves.toBe(true);
    const modal = root.querySelector('[data-modeler-shell-conformance="modal"]')!;
    expect(modal.getAttribute("role")).toBe("dialog");
    expect(modal.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(modal);
    await expect(inPage(page, canvasHandlesProbe, { root: ".cd-shell", key: "F9" })).resolves.toBe(true);
    const event = new KeyboardEvent("keydown", { key: "F9", cancelable: true });
    root.querySelector("svg")!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await inPage(page, removeInjectedProbe, null);
    expect(root.querySelector("[data-modeler-shell-conformance]")).toBeNull();
    const later = new KeyboardEvent("keydown", { key: "F9", cancelable: true });
    root.querySelector("svg")!.dispatchEvent(later);
    expect(later.defaultPrevented).toBe(false);
  });

  it("snapshots ARIA, menu and appearance facts", async () => {
    buildShell();
    const aria = await inPage(page, ariaProbe, { root: ".cd-shell" });
    expect(aria?.order).toEqual(["menu", "palette", "canvas", "status", "problems", "legend", "zoom"]);
    expect(aria?.controlled?.attributes.role).toBe("menu");
    expect(aria?.entries.map((entry) => entry.group)).toEqual(["tools", "tools"]);
    expect(aria?.legendTitle).toBe("Legend");
    expect(aria?.legendClose?.attributes["aria-label"]).toBe("Close legend");
    expect(aria?.status?.visible).toBe(false);

    const menu = await inPage(page, menuProbe, { root: ".cd-shell" });
    expect(menu?.items).toEqual([
      {
        role: "menuitemradio",
        name: "Big picture",
        checked: "true",
        disabled: null,
        haspopup: null,
        group: "Level",
      },
      { role: "menuitem", name: "Export as PNG", checked: null, disabled: null, haspopup: null, group: null },
    ]);

    document.documentElement.setAttribute("data-cd-theme", "light");
    const zoom = document.querySelector('[data-chrome="zoom"]')!;
    zoom.setAttribute("data-cd-theme", "dark");
    const facts = await inPage(page, appearanceProbe, { root: ".cd-shell", roles: MODE_ROLES });
    expect(facts?.themed.map((entry) => [entry.relation, entry.theme])).toEqual([
      ["ancestor", "light"],
      ["descendant", "dark"],
    ]);
    expect(facts?.parts.map((entry) => entry.name)).toEqual([
      "root",
      "canvas",
      "menu",
      "palette",
      "problems",
      "legend",
      "zoom",
      "unknown",
      "dropdown",
    ]);
    document.documentElement.removeAttribute("data-cd-theme");
  });

  it("remembers the root before destroy and lists what is left afterwards", async () => {
    const root = buildShell();
    await expect(inPage(page, armCleanupProbe, { root: ".cd-shell" })).resolves.toBe(true);
    root.className = "";
    root.innerHTML = '<div class="cd-shell-tooltip"></div>';
    window.dispatchEvent(new ErrorEvent("error", { message: "boom" }));
    await expect(inPage(page, leftoverProbe, null)).resolves.toEqual({
      classedElements: ["div.cd-shell-tooltip"],
      documentClasses: [],
      chromeElements: [],
      rootClasses: [],
      rootAttributes: ["class", "data-palette", "data-legend", "data-problems", "style"],
      errors: ["boom"],
    });
  });
});
