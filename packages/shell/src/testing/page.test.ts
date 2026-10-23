import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { cleanup, installFakes, mount, setBox } from "../../test/support/dom.js";
import type { MenuGroups } from "../dom/types.js";
import { menuOpenProblems } from "./checks.js";
import {
  ariaProbe,
  appearanceProbe,
  canvasStateProbe,
  focusPlaceProbe,
  menuEntriesProbe,
  menuProbe,
  paletteColorProbe,
  paletteEntriesProbe,
  paletteFocusProbe,
  readOnlyStateProbe,
  shapesProbe,
  surroundProbe,
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
import {
  blurProbe,
  clicksProbe,
  countClicksProbe,
  dragProbe,
  emptyStateProbe,
  focusOwnerProbe,
  focusToastButtonProbe,
  modeChangesProbe,
  popoverProbe,
  showModalProbe,
  toastStackTogglesProbe,
  toastsProbe,
  topRowProbe,
  watchModeProbe,
  watchToastStackProbe,
  webModeProbe,
} from "./web-facts.js";

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
    mouse: { async click() {}, async dblclick() {}, async move() {}, async down() {}, async up() {} },
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
      open: {
        legend: true,
        inspector: false,
        problems: true,
        emptyState: false,
        primaryCollapsed: false,
        zoomRaised: false,
      },
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
    const noChip = { shortcut: "", keyShortcuts: null, description: "" };
    expect(menu?.items).toEqual([
      {
        role: "menuitemradio",
        name: "Big picture",
        checked: "true",
        disabled: null,
        haspopup: null,
        group: "Level",
        ...noChip,
      },
      {
        role: "menuitem",
        name: "Export as PNG",
        checked: null,
        disabled: null,
        haspopup: null,
        group: null,
        ...noChip,
      },
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

  it("reads the surround, the palette's entries and colours, shapes and the canvas state", async () => {
    const root = buildShell();
    root.style.setProperty("--cd-ui-grund", "rgb(249, 247, 247)");
    root.style.setProperty("--cd-ui-text", "rgb(29, 29, 29)");
    root.querySelector<HTMLElement>(".cd-shell-canvas")!.style.backgroundColor = "rgb(249, 247, 247)";
    const lasso = root.querySelector<HTMLElement>('[data-action="lasso-tool"]')!;
    lasso.setAttribute("aria-pressed", "true");
    lasso.innerHTML = '<svg viewBox="0 0 20 20"></svg>';
    const svg = root.querySelector(".djs-container > svg")!;
    svg.innerHTML =
      '<g class="djs-element djs-shape selected" data-element-id="shape_1" transform="matrix(1 0 0 1 20 50)"><g class="djs-visual"><rect width="160" height="100"></rect></g></g>';
    place(svg.querySelector(".djs-shape")!, 141, 141, 160, 100);
    place(svg.querySelector(".djs-visual")!, 141, 141, 160, 100);
    const pad = document.createElement("div");
    pad.className = "djs-context-pad";
    pad.innerHTML = '<div class="entry" data-action="delete"></div>';
    root.querySelector(".djs-container")!.append(pad);
    place(pad.firstElementChild!, 300, 141, 20, 20);
    (svg as SVGElement).focus();

    const surround = await inPage(page, surroundProbe, { root: ".cd-shell" });
    expect(surround?.container).toBe(true);
    expect(surround?.painted?.description).toBe("div.cd-shell-canvas");
    expect(root.querySelector("[data-modeler-shell-conformance]")).toBeNull();

    await expect(inPage(page, paletteEntriesProbe, { root: ".cd-shell" })).resolves.toEqual([
      { action: "lasso-tool", group: "tools", pressed: true, disabled: false, client: { x: 341, y: 125 } },
      { action: "hand-tool", group: "tools", pressed: false, disabled: false, client: { x: 375, y: 125 } },
    ]);
    const colors = await inPage(page, paletteColorProbe, { root: ".cd-shell" });
    expect(colors?.entries.map((entry) => [entry.action, entry.pressed, entry.icon?.kind ?? null])).toEqual([
      ["lasso-tool", true, "svg"],
      ["hand-tool", false, null],
    ]);
    expect(Object.keys(colors?.roles ?? {})).toEqual(["text", "interaktion", "textLeise"]);
    expect(root.querySelector("[data-modeler-shell-conformance]")).toBeNull();

    const [shape] = await inPage(page, shapesProbe, { root: ".cd-shell" });
    expect(shape).toMatchObject({
      id: "shape_1",
      selected: true,
      transform: "matrix(1 0 0 1 20 50)",
      box: { left: 100, top: 100, width: 160, height: 100 },
      client: { x: 221, y: 191 },
    });
    await expect(inPage(page, canvasStateProbe, { root: ".cd-shell" })).resolves.toEqual({
      focusInCanvas: true,
      focused: "svg",
      contextPadEntries: ["delete"],
      textFields: [],
    });

    root.setAttribute("data-readonly", "");
    root.querySelector('[data-chrome="status"]')!.removeAttribute("hidden");
    await expect(inPage(page, readOnlyStateProbe, { root: ".cd-shell" })).resolves.toMatchObject({
      readOnly: true,
      status: { attributes: { role: "alert" }, visible: true },
    });
    await expect(inPage(page, readOnlyStateProbe, { root: ".nothing" })).resolves.toBeNull();
  });

  it("lists the open menu's entries with the group the shell wrote on them", async () => {
    const root = buildShell();
    await expect(inPage(page, menuEntriesProbe, { root: ".nothing" })).resolves.toBeNull();
    const menu = root.querySelector('[role="menu"]')!;
    menu.innerHTML = `
      <div role="group" aria-label="Level" data-menu-id="level" data-menu-group="model"><div role="menuitemradio" aria-checked="true">Big picture</div></div>
      <button role="menuitemcheckbox" data-menu-id="legend" data-menu-group="model" aria-checked="true">Legend</button>
      <div role="separator"></div>
      <button role="menuitem" data-menu-id="export-png" data-menu-group="export" aria-disabled="true">Export as PNG</button>
      <div role="separator"></div>
      <button role="menuitem" data-menu-id="shortcuts" data-menu-group="help">Keyboard shortcuts…</button>
      <button role="menuitem">Foreign</button>`;
    for (const item of menu.querySelectorAll("[role^='menuitem']")) place(item, 0, 0, 10, 10);
    const rest = { value: null, checked: null, icon: false };
    await expect(inPage(page, menuEntriesProbe, { root: ".cd-shell" })).resolves.toEqual([
      {
        name: "Big picture",
        role: "menuitemradio",
        menuId: "level",
        disabled: false,
        group: "model",
        ...rest,
        checked: "true",
      },
      {
        name: "Legend",
        role: "menuitemcheckbox",
        menuId: "legend",
        disabled: false,
        group: "model",
        ...rest,
        checked: "true",
      },
      {
        name: "Export as PNG",
        role: "menuitem",
        menuId: "export-png",
        disabled: true,
        group: "export",
        ...rest,
      },
      {
        name: "Keyboard shortcuts…",
        role: "menuitem",
        menuId: "shortcuts",
        disabled: false,
        group: "help",
        ...rest,
      },
      { name: "Foreign", role: "menuitem", menuId: null, disabled: false, group: null, ...rest },
    ]);
  });

  it("names menu items as assistive technology does, leaving out what it skips", async () => {
    const root = buildShell();
    root.insertAdjacentHTML("beforeend", '<span id="n1">Map</span><span id="n2" aria-label="size…">x</span>');
    const menu = root.querySelector('[role="menu"]')!;
    menu.innerHTML = `
      <button role="menuitem" aria-haspopup="dialog"><span>Keyboard shortcuts…</span><span><span class="cd-shell-menu-shortcut" aria-hidden="true">?</span></span></button>
      <button role="menuitem" aria-label=" ">Export <span hidden>as</span><span style="display: none">to</span> PNG</button>
      <button role="menuitem" aria-label="Open file">Open…</button>
      <button role="menuitem" aria-labelledby="n1 missing n2" aria-label="Ignored">Ignored</button>
      <button role="menuitem"><span style="visibility: hidden">Gone <b style="visibility: visible">Shown</b></span> <svg aria-label="Warning"></svg></button>
      <button role="menuitem"><span style="visibility: hidden" aria-label="Hidden label">x</span>Save…</button>
      <button role="menuitem"><img alt="Picture"> Insert…</button>
      <button role="menuitem"><span style="display: block">Keyboard</span><span style="display: inline-block">map…</span></button>
      <button role="menuitem" title="Tooltip name"><span aria-hidden="true">X</span></button>`;
    for (const item of menu.querySelectorAll("[role^='menuitem']")) place(item, 0, 0, 10, 10);
    const names = [
      "Keyboard shortcuts…",
      "Export PNG",
      "Open file",
      "Map size…",
      "Shown Warning",
      "Save…",
      "Picture Insert…",
      "Keyboard map…",
      "Tooltip name",
    ];
    const items = (await inPage(page, menuProbe, { root: ".cd-shell" }))?.items ?? [];
    expect(items.map((item) => item.name)).toEqual(names);
    const entries = (await inPage(page, menuEntriesProbe, { root: ".cd-shell" })) ?? [];
    expect(entries.map((entry) => entry.name)).toEqual(names);
  });

  it("reads a menu item's shortcut chip, aria-keyshortcuts and description", async () => {
    const root = buildShell();
    const menu = root.querySelector('[role="menu"]')!;
    menu.innerHTML = `
      <button role="menuitem" aria-keyshortcuts="Meta+E">Export as SVG<span class="cd-shell-menu-shortcut" aria-hidden="true">⌘E</span></button>
      <button role="menuitem" aria-describedby="c2 missing">Go to diagram<span id="c2" class="cd-shell-menu-shortcut" aria-hidden="true"> G  then D </span></button>
      <button role="menuitem" aria-describedby="c3">Print<span id="c3" class="cd-shell-menu-shortcut" hidden>⌘P</span></button>
      <button role="menuitem">Plain</button>`;
    for (const element of menu.querySelectorAll("[role^='menuitem'], .cd-shell-menu-shortcut")) {
      place(element, 0, 0, 10, 10);
    }
    const items = (await inPage(page, menuProbe, { root: ".cd-shell" }))?.items ?? [];
    expect(
      items.map(({ name, shortcut, keyShortcuts, description }) => ({
        name,
        shortcut,
        keyShortcuts,
        description,
      })),
    ).toEqual([
      { name: "Export as SVG", shortcut: "⌘E", keyShortcuts: "Meta+E", description: "" },
      { name: "Go to diagram", shortcut: "G then D", keyShortcuts: null, description: "G then D" },
      { name: "Print", shortcut: "", keyShortcuts: null, description: "⌘P" },
      { name: "Plain", shortcut: "", keyShortcuts: null, description: "" },
    ]);
  });

  it("tells whether the focus is on the canvas <svg> or on the control the kit activated", async () => {
    const root = buildShell();
    const zoomIn = '[data-chrome="zoom"] [data-zoom="in"]';
    const at = () => inPage(page, focusPlaceProbe, { root: ".cd-shell", selector: zoomIn });
    root.querySelector<HTMLElement>('[data-zoom="in"]')!.focus();
    await expect(at()).resolves.toEqual({ focused: "button", canvas: false, control: true });
    root.querySelector<SVGElement>(".djs-container > svg")!.focus();
    await expect(at()).resolves.toEqual({ focused: "svg", canvas: true, control: false });
    root.querySelector<HTMLElement>('[data-action="lasso-tool"]')!.focus();
    await expect(at()).resolves.toEqual({
      focused: "div.entry",
      canvas: false,
      control: false,
    });
    (document.activeElement as HTMLElement).blur();
    await expect(at()).resolves.toEqual({ focused: "<body>", canvas: false, control: false });
  });
});

describe("the shell's own menu through the kit", () => {
  let page: ReturnType<typeof serializingPage>;
  const checkVisibility = Element.prototype.checkVisibility;

  beforeEach(() => {
    delete (window as { __modelerShellConformance?: unknown }).__modelerShellConformance;
    Object.defineProperty(Element.prototype, "checkVisibility", { value: undefined, configurable: true });
    installFakes();
    page = serializingPage();
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(Element.prototype, "checkVisibility", {
      value: checkVisibility,
      configurable: true,
    });
  });

  /** The menu open on `groups`, every item and chip with a box, read by the kit's menu probe. */
  async function openMenu(groups: MenuGroups) {
    const { shell } = mount({ menu: groups });
    shell.menu.open();
    const { dropdown } = shell.menu;
    const boxed = dropdown.querySelectorAll("[role^='menuitem'], .cd-shell-menu-shortcut");
    for (const element of [dropdown, ...boxed]) {
      setBox(element, { left: 12, top: 60, width: 248, height: 36 });
    }
    return { dropdown, facts: async () => (await inPage(page, menuProbe, { root: "#app" }))! };
  }

  /** The menu open on a Help group of one dialog entry with the "?" chip. */
  async function openDialogEntry(label: string) {
    const { dropdown, facts } = await openMenu({
      help: [{ kind: "dialog", id: "shortcuts", label, shortcut: "?", onSelect() {} }],
    });
    expect(dropdown.querySelector(".cd-shell-menu-shortcut")?.textContent).toBe("?");
    return facts();
  }

  it("passes a dialog entry with a shortcut chip: the chip is no part of its name", async () => {
    const facts = await openDialogEntry("Keyboard shortcuts…");
    expect(facts.items.map((item) => item.name)).toEqual(["Keyboard shortcuts…"]);
    expect(menuOpenProblems(facts, "first")).toEqual([]);
  });

  it("still fails a dialog entry whose label lacks the ellipsis, chip or not", async () => {
    const facts = await openDialogEntry("Keyboard shortcuts");
    expect(menuOpenProblems(facts, "first")).toEqual([
      'menu: "Keyboard shortcuts" opens a dialog, so its label ends with "…" (U+2026)',
    ]);
  });

  it("passes chips aria-keyshortcuts cannot name, as they describe their entries", async () => {
    const { dropdown, facts } = await openMenu({
      export: [
        { kind: "action", id: "goto", label: "Go to diagram", shortcut: "G then D", onSelect() {} },
        { kind: "action", id: "print", label: "Print", shortcut: "⌘P", ariaKeyShortcuts: "", onSelect() {} },
      ],
    });
    const described = await facts();
    expect(described.items.map(({ name, description }) => [name, description])).toEqual([
      ["Go to diagram", "G then D"],
      ["Print", "⌘P"],
    ]);
    expect(menuOpenProblems(described, "first")).toEqual([]);
    for (const item of dropdown.querySelectorAll("[aria-describedby]")) {
      item.removeAttribute("aria-describedby");
    }
    expect(menuOpenProblems(await facts(), "first")).toEqual([
      'menu: "Go to diagram" shows the shortcut "G then D" but names it neither in aria-keyshortcuts nor in its description (guide §5.6)',
      'menu: "Print" shows the shortcut "⌘P" but names it neither in aria-keyshortcuts nor in its description (guide §5.6)',
    ]);
  });
});

describe("probes of the web column (0.2)", () => {
  let page: ReturnType<typeof serializingPage>;
  const checkVisibility = Element.prototype.checkVisibility;

  beforeEach(() => {
    delete (window as { __modelerShellConformance?: unknown }).__modelerShellConformance;
    Object.defineProperty(Element.prototype, "checkVisibility", { value: undefined, configurable: true });
    page = serializingPage();
  });

  afterEach(() => {
    Object.defineProperty(Element.prototype, "checkVisibility", {
      value: checkVisibility,
      configurable: true,
    });
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    for (const name of ["data-cd-theme", "data-cd-kontrast", "class"]) {
      document.documentElement.removeAttribute(name);
    }
    localStorage.clear();
  });

  /** A web shell at the page's origin: primary action, legal line, pill with its list, card, toasts. */
  function buildWebShell(): HTMLElement {
    document.documentElement.lang = "en";
    document.body.innerHTML = `
      <div class="cd-shell" data-cd-shell-host="web" data-palette="top" data-primary="collapsed" data-zoom-row="raised" data-empty-state="shown" data-problems="shown">
        <button data-chrome="menu" aria-label="Menu" aria-haspopup="menu" aria-expanded="false" aria-controls="m1"></button>
        <button data-chrome="primary" aria-label="Share" type="button"><svg></svg><span class="cd-shell-primary-label" hidden>Share</span></button>
        <div class="cd-shell-canvas" inert><div class="djs-container">
          <div class="djs-palette" data-chrome="palette"><div class="djs-palette-entries" role="toolbar" aria-label="Tools"></div></div>
          <svg tabindex="0"></svg>
        </div></div>
        <div class="cd-shell-hint" style="visibility: hidden"></div>
        <section data-chrome="empty-state" aria-labelledby="es1">
          <img src="komet.svg" alt="" />
          <h1 id="es1">Demo Modeler</h1>
          <p>Start a new diagram.</p>
          <div><button data-variant="primary">New diagram</button><button data-variant="ghost">Show example</button></div>
          <p class="cd-shell-empty-state-hint">Or drop a file here</p>
        </section>
        <button data-chrome="problems" aria-label="2 problems, 1 error" aria-haspopup="dialog" aria-expanded="false" aria-controls="p1">2 problems</button>
        <nav data-chrome="legal" aria-label="Legal">
          <a href="https://www.miragon.io/" target="_blank" rel="noopener noreferrer">© 2026 Miragon GmbH</a>
          <span aria-hidden="true">·</span>
          <a href="https://www.miragon.io/impressum/" lang="de" target="_blank" rel="noopener noreferrer">Impressum</a>
        </nav>
        <div data-chrome="zoom" role="group" aria-label="Zoom" style="visibility: hidden"><button data-zoom="actual">100%</button></div>
        <div class="cd-shell-layer">
          <div data-chrome="problems-popover" role="dialog" id="p1" aria-labelledby="pt1">
            <div id="pt1">Problems</div>
            <ul><li><button class="cd-shell-problem"><svg></svg>The box has no name. Box 1</button></li>
            <li class="cd-shell-problem"><svg></svg>Two boxes overlap.</li></ul>
          </div>
          <div data-chrome="drop-zone" aria-hidden="true"><span class="cd-shell-drop-zone-chip">Drop file here</span></div>
        </div>
        <div class="cd-shell-live"><div role="status" aria-live="polite">Link copied</div><div role="alert" aria-live="assertive"></div></div>
        <div data-chrome="toasts" popover="manual">
          <div class="cd-shell-toast" data-status="success"><span class="cd-shell-toast-text">Link copied</span><button>Undo</button><button aria-label="Close"><svg></svg></button></div>
          <div class="cd-shell-toast" role="alert" data-status="danger"><span class="cd-shell-toast-text">Couldn't open it.</span><button aria-label="Close"><svg></svg></button></div>
        </div>
      </div>
      <div class="cd-shell-toast">A stray toast</div>`;
    const root = document.querySelector<HTMLElement>(".cd-shell")!;
    place(root, 0, 0, 1280, 900);
    const at = (selector: string, left: number, top: number, width: number, height: number) =>
      place(root.querySelector(selector)!, left, top, width, height);
    at('[data-chrome="menu"]', 12, 12, 40, 40);
    at('[data-chrome="primary"]', 1228, 12, 40, 40);
    at('[data-chrome="palette"]', 316, 12, 648, 40);
    at('[data-chrome="empty-state"]', 440, 300, 400, 300);
    at('[data-chrome="empty-state"] img', 608, 332, 64, 64);
    at('[data-variant="primary"]', 500, 500, 120, 36);
    at('[data-variant="ghost"]', 628, 500, 120, 36);
    at('[data-chrome="problems"]', 12, 820, 120, 40);
    at('[data-chrome="legal"]', 12, 868, 380, 20);
    at('[data-chrome="zoom"]', 1095, 848, 173, 40);
    at('[data-chrome="problems-popover"]', 12, 692, 320, 120);
    at("button.cd-shell-problem", 13, 700, 318, 56);
    at("li.cd-shell-problem", 13, 760, 318, 36);
    at('[data-chrome="drop-zone"]', 12, 12, 1256, 876);
    at('[data-chrome="toasts"]', 400, 790, 480, 98);
    const toasts = root.querySelectorAll('[data-chrome="toasts"] [data-status]');
    place(toasts[0]!, 400, 790, 480, 42);
    place(toasts[1]!, 400, 840, 480, 42);
    for (const button of root.querySelectorAll('[data-chrome="toasts"] button'))
      place(button, 840, 795, 32, 32);
    place(document.querySelector("body > .cd-shell-toast")!, 0, 0, 100, 20);
    for (const selector of [
      ".djs-container",
      "svg",
      '[data-zoom="actual"]',
      "a",
      ".cd-shell-drop-zone-chip",
    ]) {
      for (const element of root.querySelectorAll(selector)) place(element, 0, 0, 10, 10);
    }
    return root;
  }

  it("measures the web app's state attributes", async () => {
    buildWebShell();
    const measured = await measureChrome(page);
    expect(measured.open).toEqual({
      legend: false,
      inspector: false,
      problems: true,
      emptyState: true,
      primaryCollapsed: true,
      zoomRaised: true,
    });
    expect(Object.keys(measured.islands).sort()).toEqual(
      [
        "menu",
        "palette",
        "primary",
        "problems",
        "legal",
        "toasts",
        "empty-state",
        "drop-zone",
        "problems-popover",
      ].sort(),
    );
  });

  it("snapshots the primary action, the legal links, the pill's list and the web DOM order", async () => {
    buildWebShell();
    const facts = await inPage(page, ariaProbe, { root: ".cd-shell" });
    expect(facts?.order).toEqual([
      "menu",
      "primary",
      "palette",
      "canvas",
      "hint",
      "empty-state",
      "problems",
      "legal",
      "zoom",
      "toasts",
    ]);
    expect(facts?.primary?.attributes["aria-label"]).toBe("Share");
    expect(facts?.primaryCollapsed).toBe(true);
    expect(facts?.legal?.tag).toBe("nav");
    expect(facts?.legalLinks).toEqual([
      {
        text: "© 2026 Miragon GmbH",
        href: "https://www.miragon.io/",
        lang: null,
        target: "_blank",
        rel: "noopener noreferrer",
      },
      {
        text: "Impressum",
        href: "https://www.miragon.io/impressum/",
        lang: "de",
        target: "_blank",
        rel: "noopener noreferrer",
      },
    ]);
    expect(facts?.problemsControlled?.attributes.role).toBe("dialog");
  });

  it("reads <html>'s mode, its metas and the stored choice, also from a blocked storage", async () => {
    document.documentElement.setAttribute("data-cd-theme", "system");
    document.documentElement.setAttribute("data-cd-kontrast", "hoch");
    document.documentElement.classList.add("cd-shell-no-transition");
    document.head.innerHTML = `
      <meta name="color-scheme" content="light dark">
      <meta name="theme-color" content="#335DE5" media="(prefers-color-scheme: light)">
      <meta name="theme-color" content="#1D1D1D" media="(prefers-color-scheme: dark)">`;
    localStorage.setItem("miragon.darstellung", "dark");
    await expect(inPage(page, webModeProbe, { key: "miragon.darstellung" })).resolves.toEqual({
      theme: "system",
      kontrast: "hoch",
      colorScheme: "light dark",
      themeColors: [
        { content: "#335DE5", media: "(prefers-color-scheme: light)" },
        { content: "#1D1D1D", media: "(prefers-color-scheme: dark)" },
      ],
      stored: "dark",
      storageBlocked: false,
      noTransition: true,
    });
    // A browser that blocks storage throws on reading window.localStorage itself.
    const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    try {
      await expect(inPage(page, webModeProbe, { key: "miragon.darstellung" })).resolves.toMatchObject({
        stored: null,
        storageBlocked: true,
      });
    } finally {
      if (descriptor) Object.defineProperty(window, "localStorage", descriptor);
      else delete (window as { localStorage?: unknown }).localStorage;
    }
  });

  it("records a mode switch with its frames until the kit reads it", async () => {
    document.head.innerHTML = `<meta name="color-scheme" content="light dark"><meta name="theme-color" content="#335DE5" media="(prefers-color-scheme: light)">`;
    await inPage(page, watchModeProbe, null);
    const html = document.documentElement;
    html.classList.add("cd-shell-no-transition");
    html.setAttribute("data-cd-theme", "dark");
    html.setAttribute("data-cd-kontrast", "hoch");
    document.querySelector('meta[name="color-scheme"]')!.setAttribute("content", "dark");
    document.querySelector('meta[name="theme-color"]')!.setAttribute("content", "#1D1D1D");
    await new Promise((resolve) => setTimeout(resolve, 0));
    const changes = await inPage(page, modeChangesProbe, null);
    expect(changes.map((change) => [change.part, change.value])).toEqual([
      ["no-transition", "on"],
      ["theme", "dark"],
      ["kontrast", "hoch"],
      ["color-scheme", "dark"],
      ["theme-color", "#1D1D1D (prefers-color-scheme: light)"],
    ]);
    expect(new Set(changes.map((change) => change.frame)).size).toBe(1);
    await expect(inPage(page, modeChangesProbe, null)).resolves.toEqual([]);
  });

  it("reads the top row: palette width, menu edge and the primary action", async () => {
    const root = buildWebShell();
    const palette = root.querySelector<HTMLElement>('[data-chrome="palette"]')!;
    for (const [property, value] of [
      ["offsetWidth", 648],
      ["clientWidth", 646],
      ["scrollWidth", 646],
    ] as const) {
      Object.defineProperty(palette, property, { value, configurable: true });
    }
    await expect(inPage(page, topRowProbe, { root: ".cd-shell" })).resolves.toEqual({
      container: { width: 1280, height: 900 },
      paletteRow: "top",
      paletteWidth: 648,
      menuRight: 52,
      primary: {
        box: { left: 1228, top: 12, width: 40, height: 40 },
        client: { x: 1248, y: 32 },
        collapsed: true,
        ariaLabel: "Share",
        describedBy: null,
        label: null,
      },
    });
    root.removeAttribute("data-primary");
    const label = root.querySelector<HTMLElement>(".cd-shell-primary-label")!;
    label.hidden = false;
    place(label, 1252, 22, 38, 20);
    await expect(inPage(page, topRowProbe, { root: ".cd-shell" })).resolves.toMatchObject({
      primary: { collapsed: false, label: "Share" },
    });
    await expect(inPage(page, topRowProbe, { root: ".nothing" })).resolves.toBeNull();
  });

  it("counts clicks on the primary action until the stand-ins go", async () => {
    const root = buildWebShell();
    await expect(
      inPage(page, countClicksProbe, { root: ".cd-shell", selector: '[data-chrome="primary"]' }),
    ).resolves.toBe(true);
    const primary = root.querySelector<HTMLElement>('[data-chrome="primary"]')!;
    primary.click();
    primary.click();
    await expect(inPage(page, clicksProbe, null)).resolves.toBe(2);
    await inPage(page, removeInjectedProbe, null);
    primary.click();
    await expect(inPage(page, clicksProbe, null)).resolves.toBe(2);
    await expect(inPage(page, countClicksProbe, { root: ".cd-shell", selector: ".nothing" })).resolves.toBe(
      false,
    );
  });

  it("reads the start screen, the work chrome it hides and the inert canvas", async () => {
    buildWebShell();
    const facts = await inPage(page, emptyStateProbe, {
      root: ".cd-shell",
      work: ["menu", "zoom", "legend"],
    });
    expect(facts).toEqual({
      shown: true,
      card: {
        visible: true,
        box: { left: 440, top: 300, width: 400, height: 300 },
        tag: "section",
        labelledBy: "Demo Modeler",
      },
      komet: { tag: "img", alt: "", width: 64, height: 64 },
      heading: { tag: "h1", text: "Demo Modeler" },
      buttons: [
        { variant: "primary", name: "New diagram", height: 36, client: { x: 560, y: 518 } },
        { variant: "ghost", name: "Show example", height: 36, client: { x: 688, y: 518 } },
      ],
      hint: "Or drop a file here",
      work: [
        { name: "menu", visibility: expect.any(String), visible: true },
        { name: "zoom", visibility: "hidden", visible: false },
        { name: "hint", visibility: "hidden", visible: false },
      ],
      canvasInert: true,
      legalVisible: true,
    });
  });

  it("names the owner of the focus and blurs it", async () => {
    const root = buildWebShell();
    await expect(inPage(page, focusOwnerProbe, { root: ".cd-shell" })).resolves.toEqual({
      owner: "body",
      description: "<body>",
    });
    root.querySelector<HTMLElement>('[data-variant="primary"]')!.focus();
    await expect(inPage(page, focusOwnerProbe, { root: ".cd-shell" })).resolves.toEqual({
      owner: "empty-state",
      description: "button",
    });
    root.querySelector(".cd-shell-canvas")!.removeAttribute("inert");
    root.querySelector<SVGElement>(".djs-container > svg")!.focus();
    await expect(inPage(page, focusOwnerProbe, { root: ".cd-shell" })).resolves.toMatchObject({
      owner: "canvas",
    });
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    await expect(inPage(page, focusOwnerProbe, { root: ".cd-shell" })).resolves.toMatchObject({
      owner: "outside",
    });
    await inPage(page, blurProbe, null);
    expect(document.activeElement).toBe(document.body);
  });

  it("reads the toast stack, its toasts and their buttons, and toasts outside it", async () => {
    buildWebShell();
    const facts = await inPage(page, toastsProbe, { root: ".cd-shell" });
    expect(facts?.stack).toEqual({
      visible: true,
      box: { left: 400, top: 790, width: 480, height: 98 },
      popover: "manual",
      popoverOpen: false,
    });
    expect(
      facts?.toasts.map((toast) => [
        toast.text,
        toast.role,
        toast.status,
        toast.buttons.map((button) => button.name),
      ]),
    ).toEqual([
      ["Link copiedUndo", null, "success", ["Undo", "Close"]],
      ["Couldn't open it.", "alert", "danger", ["Close"]],
    ]);
    expect(facts?.live).toEqual([
      { role: "status", live: "polite", text: "Link copied" },
      { role: "alert", live: "assertive", text: "" },
    ]);
    expect(facts?.toasts[0]?.buttons[0]?.text).toBe("Undo");
    expect(facts?.strays).toEqual(["div.cd-shell-toast"]);
    await expect(
      inPage(page, focusToastButtonProbe, { root: ".cd-shell", text: "Link copied", name: "Close" }),
    ).resolves.toBe(true);
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Close");
    await expect(
      inPage(page, focusToastButtonProbe, { root: ".cd-shell", text: "Nothing", name: "Close" }),
    ).resolves.toBe(false);
    await expect(inPage(page, toastsProbe, { root: ".nothing" })).resolves.toBeNull();
  });

  it("records the stack's popover toggles and opens a modal stand-in", async () => {
    const root = buildWebShell();
    await expect(inPage(page, watchToastStackProbe, { root: ".cd-shell" })).resolves.toBe(true);
    const stack = root.querySelector('[data-chrome="toasts"]')!;
    for (const newState of ["closed", "open"]) {
      const event = new Event("beforetoggle");
      Object.defineProperty(event, "newState", { value: newState });
      stack.dispatchEvent(event);
    }
    await expect(inPage(page, toastStackTogglesProbe, { root: ".cd-shell" })).resolves.toEqual({
      toggles: ["closed", "open"],
      open: false,
    });
    const modal = await inPage(page, showModalProbe, null);
    const dialog = document.querySelector<HTMLDialogElement>(
      'dialog[data-modeler-shell-conformance="show-modal"]',
    );
    expect(typeof modal).toBe("boolean");
    expect(dialog?.open).toBe(true);
    await inPage(page, removeInjectedProbe, null);
    expect(document.querySelector("dialog")).toBeNull();
    await expect(inPage(page, watchToastStackProbe, { root: ".nothing" })).resolves.toBe(false);
  });

  it("reads the pill, the list it controls, its rows and the focus", async () => {
    const root = buildWebShell();
    root.querySelector<HTMLElement>("button.cd-shell-problem")!.focus();
    const facts = await inPage(page, popoverProbe, { root: ".cd-shell" });
    expect(facts?.pill).toMatchObject({
      attributes: { "aria-haspopup": "dialog", "aria-controls": "p1" },
      box: { left: 12, top: 820, width: 120, height: 40 },
      client: { x: 72, y: 840 },
      visible: true,
    });
    expect(facts?.popover).toMatchObject({
      visible: true,
      title: "Problems",
      attributes: { role: "dialog" },
    });
    expect(facts?.rows).toEqual([
      {
        button: true,
        height: 56,
        icon: true,
        text: "The box has no name. Box 1",
        client: { x: 172, y: 728 },
      },
      { button: false, height: 36, icon: true, text: "Two boxes overlap.", client: { x: 172, y: 778 } },
    ]);
    expect(facts?.focus).toBe("popover");
    root.querySelector<HTMLElement>('[data-chrome="problems"]')!.focus();
    await expect(inPage(page, popoverProbe, { root: ".cd-shell" })).resolves.toMatchObject({ focus: "pill" });
  });

  it("dispatches synthetic file drags and records the drop effect the page sets", async () => {
    const root = buildWebShell();
    const seen: Array<{ type: string; kinds: string[]; files: string[] }> = [];
    const listener = (event: Event) => {
      const transfer = (event as DragEvent).dataTransfer!;
      seen.push({
        type: event.type,
        kinds: [...transfer.items].map((item) => `${item.kind}:${item.type}`),
        files: [...transfer.files].map((file) => file.name),
      });
      event.preventDefault();
      transfer.dropEffect = "copy";
      root.setAttribute("data-drop", "over");
    };
    for (const type of ["dragenter", "dragover", "drop"]) window.addEventListener(type, listener);
    document.elementFromPoint = () => root;
    try {
      const facts = await inPage(page, dragProbe, {
        root: ".cd-shell",
        files: [{ name: "board.json", type: "application/json", text: "{}" }],
        strings: ["text"],
        steps: ["dragenter", "dragover", "drop"],
      });
      expect(facts?.state).toBe("over");
      expect(facts?.events).toEqual([
        { type: "dragenter", defaultPrevented: true, dropEffect: "copy" },
        { type: "dragover", defaultPrevented: true, dropEffect: "copy" },
        { type: "drop", defaultPrevented: true, dropEffect: "copy" },
      ]);
      expect(seen[0]).toEqual({
        type: "dragenter",
        kinds: ["file:application/json", "string:text/plain"],
        files: ["board.json"],
      });
      expect(facts?.zone).toMatchObject({
        visible: true,
        box: { left: 12, top: 12, width: 1256, height: 876 },
        ariaHidden: "true",
      });
      expect(facts?.chip?.text).toBe("Drop file here");
      expect(Object.keys(facts?.roles ?? {})).toEqual([
        "hover",
        "interaktion",
        "dangerFlaeche",
        "danger",
        "flaecheHoch",
      ]);
      expect(root.querySelector('[data-modeler-shell-conformance="role-probe"]')).toBeNull();
    } finally {
      for (const type of ["dragenter", "dragover", "drop"]) window.removeEventListener(type, listener);
      delete (document as { elementFromPoint?: unknown }).elementFromPoint;
    }
    await expect(inPage(page, dragProbe, { root: ".nothing", files: [], steps: [] })).resolves.toBeNull();
  });
});
