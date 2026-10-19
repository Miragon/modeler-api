import { describe, expect, it } from "vitest";

import {
  absentIslandProblems,
  absentIslands,
  afterDestroyKeyProblem,
  appearanceProblems,
  ariaProblems,
  createProblems,
  expectedAppearance,
  expectedKeyShortcuts,
  harnessHookProblems,
  isToolEntry,
  keyReachProblem,
  leftoverProblems,
  lockedShapeProblems,
  menuClosedProblems,
  menuKeysAtDocumentProblems,
  menuOpenProblems,
  optionalIslandProblems,
  paletteColorProblems,
  paletteShortcutProblems,
  readOnlyMenuProblems,
  readOnlyPaletteProblems,
  readOnlyStateProblems,
  surroundProblems,
  tabSequenceProblems,
  type CreateFacts,
  type KeyReach,
  type LockedShapeFacts,
} from "./checks.js";
import type {
  AppearanceFacts,
  AriaFacts,
  CanvasStateFacts,
  MenuEntryFacts,
  MenuFacts,
  ModeFacts,
  PaletteColorEntry,
  PaletteColorFacts,
  PaletteEntryState,
  ShapeFacts,
} from "./facts.js";
import type { ElementFacts, LeftoverFacts, RecordedKey } from "./page-tools.js";

function element(tag: string, attributes: Record<string, string> = {}, text = ""): ElementFacts {
  return { tag, description: tag, attributes, text, visible: true, disabled: false };
}

function conformingAria(): AriaFacts {
  const shortcuts = expectedKeyShortcuts("mac");
  return {
    platform: "mac",
    documentLang: "en",
    rootLang: null,
    trigger: element("button", {
      "data-chrome": "menu",
      "aria-label": "Menu",
      "aria-haspopup": "menu",
      "aria-expanded": "false",
      "aria-controls": "cd-shell-menu-1",
    }),
    controlled: element("div", { id: "cd-shell-menu-1", role: "menu", "aria-label": "Menu" }),
    palette: element("div", { "data-chrome": "palette" }),
    toolbar: element("div", { role: "toolbar", "aria-label": "Tools" }),
    canvas: element("svg", { tabindex: "0", role: "application", "aria-label": "Diagram" }),
    entries: [
      {
        ...element("div", {
          "data-action": "lasso-tool",
          role: "button",
          "aria-label": "Lasso",
          tabindex: "0",
          "aria-pressed": "false",
        }),
        group: "tools",
      },
      {
        ...element("div", {
          "data-action": "hand-tool",
          role: "button",
          "aria-label": "Hand",
          tabindex: "-1",
          "aria-pressed": "true",
        }),
        group: "tools",
      },
      {
        ...element("div", {
          "data-action": "create.box",
          role: "button",
          "aria-label": "Box",
          tabindex: "-1",
        }),
        group: "shapes",
      },
    ],
    zoom: element("div", { "data-chrome": "zoom", role: "group", "aria-label": "Zoom" }),
    zoomButtons: {
      out: element("button", { "aria-label": "Zoom out", "aria-keyshortcuts": shortcuts.out }),
      actual: element(
        "button",
        { "aria-label": "Zoom to 100% (now 86%)", "aria-keyshortcuts": shortcuts.actual },
        "86%",
      ),
      in: element("button", { "aria-label": "Zoom in", "aria-keyshortcuts": shortcuts.in }),
      fit: element("button", { "aria-label": "Fit to view", "aria-keyshortcuts": shortcuts.fit }),
    },
    order: ["menu", "palette", "canvas", "status", "problems", "zoom"],
    positiveTabindex: [],
    titled: [],
    problems: null,
    status: null,
    legend: null,
    legendTitle: null,
    legendClose: null,
    inspector: null,
  };
}

describe("expectedKeyShortcuts", () => {
  it("names the WAI-ARIA keys of the user's platform", () => {
    expect(expectedKeyShortcuts("mac")).toEqual({
      in: "Meta+= Meta+Plus",
      out: "Meta+-",
      actual: "Meta+0",
      fit: "Shift+1",
    });
    expect(expectedKeyShortcuts("other")).toEqual({
      in: "Control+= Control+Plus",
      out: "Control+-",
      actual: "Control+0",
      fit: "Shift+1",
    });
  });
});

describe("ariaProblems", () => {
  it("accepts the conforming chrome", () => {
    expect(ariaProblems(conformingAria(), "ide")).toEqual([]);
  });

  it("accepts a German readout whose label carries a no-break space", () => {
    const facts = conformingAria();
    facts.zoomButtons.actual = element(
      "button",
      { "aria-label": "Auf 100 % zoomen (jetzt 86 %)", "aria-keyshortcuts": "Meta+0" },
      "86 %",
    );
    expect(ariaProblems(facts, "ide")).toEqual([]);
  });

  it("checks the menu trigger", () => {
    const facts = conformingAria();
    facts.trigger!.attributes["aria-haspopup"] = "true";
    facts.trigger!.attributes["aria-expanded"] = "true";
    facts.controlled = element("div", { id: "cd-shell-menu-1" });
    expect(ariaProblems(facts, "ide")).toEqual([
      'menu: aria-haspopup is "true", expected "menu"',
      'menu: aria-expanded is "true" while closed, expected "false"',
      'menu: aria-controls names a div with role "", expected "menu"',
    ]);
  });

  it("checks the palette toolbar and its roving tabindex", () => {
    const facts = conformingAria();
    facts.toolbar = element("div", { class: "djs-palette-entries" });
    facts.entries[2]!.attributes.tabindex = "0";
    delete facts.entries[0]!.attributes["aria-pressed"];
    expect(ariaProblems(facts, "ide")).toEqual([
      'palette: .djs-palette-entries has no role="toolbar"',
      'palette: 2 entries with tabindex="0", expected exactly one (roving tabindex)',
      'palette: tool "lasso-tool" has no aria-pressed',
    ]);
  });

  it("checks the zoom panel's shortcuts, readout and disabled state", () => {
    const facts = conformingAria();
    facts.zoomButtons.in!.attributes["aria-keyshortcuts"] = "Control+= Control+Plus";
    facts.zoomButtons.out!.disabled = true;
    facts.zoomButtons.actual!.attributes["aria-label"] = "Zoom to 100%";
    expect(ariaProblems(facts, "ide")).toEqual([
      'zoom: [data-zoom="out"] is natively disabled; aria-disabled keeps the focus (guide §5.8)',
      'zoom: [data-zoom="in"] aria-keyshortcuts is "Control+= Control+Plus", expected "Meta+= Meta+Plus" (mac)',
      'zoom: the readout\'s aria-label "Zoom to 100%" does not name the current zoom "86%"',
    ]);
  });

  it("checks DOM order, positive tabindex and native titles", () => {
    const facts = conformingAria();
    facts.order = ["menu", "canvas", "palette", "status", "problems", "zoom"];
    facts.positiveTabindex = ['button[data-chrome="menu"] (tabindex="2")'];
    facts.titled = ['div[data-chrome="zoom"]'];
    expect(ariaProblems(facts, "ide")).toEqual([
      "DOM order is menu, canvas, palette, status, problems, zoom; expected menu, palette, canvas, status, problems, zoom (guide §5.14)",
      'positive tabindex on button[data-chrome="menu"] (tabindex="2") (guide §5.14)',
      'div[data-chrome="zoom"] has a native title; the chrome tooltip replaces it (guide §5.6)',
    ]);
  });

  it("wants the tool's lang on an embedded root", () => {
    expect(ariaProblems(conformingAria(), "embedded")).toEqual([
      "root: an embedded shell root carries the tool's lang itself (guide §2, §12)",
    ]);
    expect(ariaProblems({ ...conformingAria(), rootLang: "en" }, "embedded")).toEqual([]);
  });
});

describe("the canvas name, the tab sequence, palette shortcuts and menu keys", () => {
  it("wants a name on the focusable canvas", () => {
    const facts = conformingAria();
    facts.canvas = element("svg", { tabindex: "0" });
    expect(ariaProblems(facts, "ide")).toEqual([
      'canvas: the focusable <svg> has no accessible name (WCAG 4.1.2); shellModule names it role="application" with messages.canvas',
    ]);
    facts.canvas = element("svg", { tabindex: "0", "aria-labelledby": "board-title" });
    expect(ariaProblems(facts, "ide")).toEqual([]);
  });

  it("accepts trigger → palette → canvas, with the web app's primary action first", () => {
    const palette = { description: "div.entry", kind: "palette" } as const;
    const canvas = { description: "svg", kind: "canvas" } as const;
    expect(tabSequenceProblems([palette, canvas, { description: "button", kind: "other" }])).toEqual([]);
    expect(tabSequenceProblems([{ description: "button", kind: "primary" }, palette, canvas])).toEqual([]);
  });

  it("names an extra tab stop between palette and canvas, and a palette Tab skips", () => {
    const extra = { description: 'div.djs-container[tabindex="0"]', kind: "other" } as const;
    expect(
      tabSequenceProblems([
        { description: "div.entry", kind: "palette" },
        extra,
        { description: "svg", kind: "canvas" },
      ]),
    ).toEqual([
      'tab order: Tab from the palette lands on div.djs-container[tabindex="0"], expected the canvas <svg> (an unexpected tab stop, guide §5.14)',
    ]);
    expect(tabSequenceProblems([extra])).toEqual([
      `tab order: Tab from the menu trigger lands on div.djs-container[tabindex="0"], expected the palette's roving entry (guide §5.14)`,
    ]);
  });

  it("wants aria-keyshortcuts on a palette entry whose tooltip shows a shortcut", () => {
    expect(
      paletteShortcutProblems([
        { action: "lasso-tool", chip: "L", keyShortcuts: "L" },
        { action: "hand-tool", chip: "H", keyShortcuts: null },
        { action: "create.box", chip: "", keyShortcuts: null },
      ]),
    ).toEqual([
      'palette: entry "hand-tool" shows the shortcut "H" in its tooltip but has no aria-keyshortcuts (guide §5.6)',
    ]);
  });

  it("reports menu keys that reached a document listener", () => {
    const recorded = (key: string): RecordedKey => ({
      key,
      code: key,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      defaultPrevented: true,
    });
    expect(menuKeysAtDocumentProblems(["ArrowUp", "ArrowDown"], [])).toEqual([]);
    expect(menuKeysAtDocumentProblems(["ArrowUp", "ArrowDown"], [recorded("ArrowDown")])).toEqual([
      "menu: ArrowDown in the open menu reached a keydown listener on document; a modeler's document keyboard acts on it (stop it at the menu, guide §5.4)",
    ]);
  });
});

describe("optionalIslandProblems", () => {
  it("checks pill, status box, legend and inspector once shown", () => {
    const facts: AriaFacts = {
      ...conformingAria(),
      problems: element("button", { "aria-label": "2 problems, 1 error" }, "2 problems"),
      status: element("div", { role: "alert", "data-severity": "danger" }, "Invalid"),
      legend: element("section", { "aria-labelledby": "cd-shell-legend-title-1" }),
      legendTitle: "Legend",
      legendClose: element("button", { "aria-label": "Close legend" }),
      inspector: element("aside", { "aria-label": "Properties" }),
    };
    const all = new Set(["problems", "status", "legend", "inspector"]);
    expect(optionalIslandProblems(facts, all)).toEqual([]);

    const broken: AriaFacts = {
      ...facts,
      problems: element("div", { "aria-label": "Problems" }, "2 problems"),
      status: element("div", { role: "status", "data-severity": "danger" }),
      legendTitle: null,
      inspector: element("div", {}),
    };
    expect(optionalIslandProblems(broken, all)).toEqual([
      "problems: the pill is a <div>, expected a <button>",
      'problems: the aria-label "Problems" does not contain the visible text "2 problems"',
      'status: role is "status" for data-severity="danger", expected "alert"',
      "legend: the card is not labelled by its title (aria-labelledby)",
      "inspector: a <div>, expected an <aside>",
      "inspector: the <aside> has no aria-label",
    ]);
  });

  it('expects role="status" for a warning and reports islands a hook did not show', () => {
    const facts: AriaFacts = {
      ...conformingAria(),
      status: element("div", { role: "status", "data-severity": "warning" }),
      inspector: { ...element("aside", { "aria-label": "Properties" }), visible: false },
    };
    expect(optionalIslandProblems(facts, new Set(["status", "inspector"]))).toEqual([
      "inspector: the inspector is not visible after show.inspector",
    ]);
  });
});

function openMenu(overrides: Partial<MenuFacts> = {}): MenuFacts {
  return {
    expanded: "true",
    controls: "cd-shell-menu-1",
    menu: element("div", { id: "cd-shell-menu-1", role: "menu", "aria-label": "Menu" }),
    items: [
      {
        role: "menuitemradio",
        name: "Big picture",
        checked: "true",
        disabled: null,
        haspopup: null,
        group: "Level",
      },
      {
        role: "menuitemcheckbox",
        name: "Snap to grid",
        checked: "false",
        disabled: null,
        haspopup: null,
        group: null,
      },
      { role: "menuitem", name: "Export as PNG", checked: null, disabled: null, haspopup: null, group: null },
      {
        role: "menuitem",
        name: "Keyboard shortcuts…",
        checked: null,
        disabled: null,
        haspopup: "dialog",
        group: null,
      },
    ],
    active: 0,
    activeIsTrigger: false,
    ...overrides,
  };
}

describe("menu checks", () => {
  it("accepts an open menu focused on its first entry", () => {
    expect(menuOpenProblems(openMenu(), "first")).toEqual([]);
    expect(menuOpenProblems(openMenu({ active: 3 }), "last")).toEqual([]);
  });

  it("reports state, names, groups and focus", () => {
    const facts = openMenu({
      expanded: "false",
      active: -1,
      items: [
        {
          role: "menuitemradio",
          name: "Big picture",
          checked: null,
          disabled: null,
          haspopup: null,
          group: null,
        },
        {
          role: "menuitem",
          name: "Keyboard shortcuts...",
          checked: null,
          disabled: null,
          haspopup: "dialog",
          group: null,
        },
        { role: "menuitem", name: "", checked: null, disabled: null, haspopup: null, group: null },
      ],
    });
    expect(menuOpenProblems(facts, "first")).toEqual([
      'menu: aria-expanded is "false" while open, expected "true"',
      'menu: "Big picture" (menuitemradio) has aria-checked ""',
      'menu: radio "Big picture" is not in a labelled role="group"',
      'menu: "Keyboard shortcuts..." opens a dialog, so its label ends with "…" (U+2026)',
      "menu: item 3 has no accessible name",
      "menu: focus is on no entry, expected the first entry",
    ]);
  });

  it("requires the closed menu to hand the focus back to the trigger", () => {
    const closed = openMenu({ expanded: "false", menu: null, items: [], active: -1, activeIsTrigger: true });
    expect(menuClosedProblems(closed, true)).toEqual([]);
    expect(menuClosedProblems({ ...closed, activeIsTrigger: false }, true)).toEqual([
      "menu: Escape did not return the focus to the trigger",
    ]);
  });
});

describe("keyReachProblem", () => {
  const key = (defaultPrevented: boolean): RecordedKey => ({
    key: "=",
    code: "Equal",
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented,
  });

  it.each([
    ["handled", "ide", [], true],
    ["handled", "ide", [key(true)], false],
    ["blocked", "ide", [], true],
    ["canvas", "ide", [key(true)], false],
    ["free", "ide", [key(false)], true],
    ["free", "ide", [], false],
    ["handled", "web", [key(true)], true],
    ["handled", "web", [key(false)], false],
    ["handled", "embedded", [], false],
    ["blocked", "web", [key(false)], true],
    ["blocked", "embedded", [key(true)], false],
    ["canvas", "web", [key(true)], true],
    ["free", "web", [key(true)], false],
    ["free", "web", [key(false), key(false)], false],
  ] as const)("%s key in the %s host, window saw %j: conforming %s", (reach, host, recorded, conforming) => {
    const problem = keyReachProblem("Control+Equal", reach as KeyReach, host, { keys: recorded });
    if (conforming) expect(problem).toBeUndefined();
    else expect(problem).toEqual(expect.any(String));
  });

  it("names VS Code for a key that reaches window in the IDE host", () => {
    expect(keyReachProblem("Control+Equal on the canvas", "handled", "ide", { keys: [key(true)] })).toBe(
      "Control+Equal on the canvas reached a keydown listener on window; in the IDE host the shell stops it on document, or VS Code runs it again (guide §13.5)",
    );
  });

  it("reads preventDefault on document where the IDE host stops the key", () => {
    const stopped = (prevented: boolean) => ({ keys: [], documentKeys: [key(prevented)] });
    expect(keyReachProblem("Control+Equal", "handled", "ide", stopped(true))).toBeUndefined();
    expect(keyReachProblem("Control+Equal", "handled", "ide", stopped(false))).toBe(
      "Control+Equal was stopped but not prevented; a handled key also calls preventDefault",
    );
    expect(keyReachProblem("Control+KeyZ in a text field", "blocked", "ide", stopped(false))).toBeUndefined();
    expect(keyReachProblem("Control+KeyZ in a text field", "blocked", "ide", stopped(true))).toBe(
      "Control+KeyZ in a text field was prevented; the shell only stops it, so the field, dialog or browser still acts (guide §13.5)",
    );
  });
});

describe("expectedAppearance", () => {
  it("never shows a mode the modeler cannot show, and lets high contrast through", () => {
    expect(expectedAppearance({ theme: "dark" }, ["light"])).toEqual({ theme: "light" });
    expect(expectedAppearance({ theme: "dark", kontrast: "hoch" }, ["light"])).toEqual({
      theme: "light",
      kontrast: "hoch",
    });
    expect(expectedAppearance({ theme: "dark" }, ["light", "dark"])).toEqual({ theme: "dark" });
    expect(() => expectedAppearance({ theme: "dark" }, [])).toThrow(/harness.themes is empty/);
  });
});

const LIGHT_ROLES = {
  "--cd-ui-grund": "#F7F7F7",
  "--cd-ui-text": "#1D1D1D",
  "--cd-ui-flaeche-hoch": "#FFFFFF",
  "--cd-ui-linie": "#E0E0E0",
};

function part(name: string, colorScheme = "light", roles: Record<string, string> = LIGHT_ROLES): ModeFacts {
  return { name, description: name, colorScheme, roles: { ...roles } };
}

function appearance(overrides: Partial<AppearanceFacts> = {}): AppearanceFacts {
  return {
    documentClasses: ["cd-shell-document"],
    themed: [
      { description: "html", isDocument: true, relation: "ancestor", theme: "light", kontrast: "hoch" },
    ],
    parts: ["root", "canvas", "menu", "palette", "zoom", "dropdown", "tooltip"].map((name) => part(name)),
    ...overrides,
  };
}

describe("appearanceProblems", () => {
  const darkHigh = { theme: "dark", kontrast: "hoch" } as const;

  it("accepts a light-only modeler that stays light with high contrast", () => {
    expect(appearanceProblems(appearance(), "ide", darkHigh, ["light"])).toEqual({ problems: [] });
  });

  it("reports a dark subtree as half-dark", () => {
    const facts = appearance();
    facts.themed.push({
      description: 'div[data-chrome="zoom"]',
      isDocument: false,
      relation: "descendant",
      theme: "dark",
      kontrast: null,
    });
    facts.parts[4] = part("zoom", "dark", { ...LIGHT_ROLES, "--cd-ui-text": "#FFFFFF" });
    expect(appearanceProblems(facts, "ide", darkHigh, ["light"]).problems).toEqual([
      'div[data-chrome="zoom"] carries data-cd-theme="dark": a second mode inside the modeler is half-dark (guide §13.5)',
      'zoom: color-scheme is "dark" (requested dark + hoch, expected light + hoch)',
      'zoom: --cd-ui-text resolves to "#FFFFFF", the root to "#1D1D1D" (half-dark)',
    ]);
  });

  it("keeps the attributes on <html> alone in an own document", () => {
    const facts = appearance();
    facts.themed.push({
      description: "div.cd-shell",
      isDocument: false,
      relation: "self",
      theme: "light",
      kontrast: "hoch",
    });
    expect(appearanceProblems(facts, "ide", darkHigh, ["light"]).problems).toEqual([
      'div.cd-shell repeats data-cd-theme="light" data-cd-kontrast="hoch": in an own document the attributes stand only on <html> (guide §13.5)',
    ]);
  });

  it("wants the attributes on <html> in an own document, always", () => {
    const facts = appearance({
      themed: [],
      parts: appearance().parts.map((entry) => ({ ...entry, colorScheme: "normal" })),
    });
    expect(appearanceProblems(facts, "ide", { theme: "dark" }, ["light"]).problems).toEqual([
      '<html> has no data-cd-theme (requested dark, expected light); the host always writes it, also "light" (guide §13.3)',
    ]);
    const wrong = appearance({
      themed: [
        { description: "html", isDocument: true, relation: "ancestor", theme: "dark", kontrast: null },
      ],
    });
    expect(appearanceProblems(wrong, "web", darkHigh, ["light"]).problems).toEqual([
      'html has data-cd-theme="dark" (requested dark + hoch, expected light + hoch)',
      "html has no data-cd-kontrast (requested dark + hoch, expected light + hoch)",
    ]);
  });

  it("reports the own-document class in the wrong host", () => {
    expect(
      appearanceProblems(appearance({ documentClasses: [] }), "ide", darkHigh, ["light"]).problems,
    ).toEqual(["<html> lacks cd-shell-document in an own document (the reset of the webview's host styles)"]);
    const embedded = appearance({
      themed: [
        { description: "html", isDocument: true, relation: "ancestor", theme: "dark", kontrast: "hoch" },
        {
          description: "div.cd-shell",
          isDocument: false,
          relation: "self",
          theme: "light",
          kontrast: "hoch",
        },
      ],
    });
    expect(appearanceProblems(embedded, "embedded", darkHigh, ["light"]).problems).toEqual([
      "<html> of a foreign page carries cd-shell-document: the own-document reset restyles the host page",
    ]);
  });

  it("wants an embedded root to carry its own mode: without, it takes a dark page's", () => {
    const facts = appearance({
      documentClasses: [],
      themed: [
        { description: "html", isDocument: true, relation: "ancestor", theme: "dark", kontrast: null },
      ],
      parts: appearance().parts.map((entry) => ({ ...entry, colorScheme: "dark" })),
    });
    expect(appearanceProblems(facts, "embedded", { theme: "dark" }, ["light"]).problems).toEqual([
      "the embedded root has no data-cd-theme (host page dark, expected light): it takes the host page's mode instead of its own (guide §13.3)",
      'root: color-scheme is "dark" (host page dark, expected light)',
      'canvas: color-scheme is "dark" (host page dark, expected light)',
      'menu: color-scheme is "dark" (host page dark, expected light)',
      'palette: color-scheme is "dark" (host page dark, expected light)',
      'zoom: color-scheme is "dark" (host page dark, expected light)',
      'dropdown: color-scheme is "dark" (host page dark, expected light)',
      'tooltip: color-scheme is "dark" (host page dark, expected light)',
    ]);
  });

  it("keeps an embedded root in its first mode under a dark page and takes the page's contrast over", () => {
    const root = (kontrast: string | null) => ({
      description: "div.cd-shell",
      isDocument: false,
      relation: "self" as const,
      theme: "light",
      kontrast,
    });
    const page = (kontrast: string | null) => ({
      description: "html",
      isDocument: true,
      relation: "ancestor" as const,
      theme: "dark",
      kontrast,
    });
    const embedded = (themed: AppearanceFacts["themed"]) => appearance({ documentClasses: [], themed });
    expect(
      appearanceProblems(embedded([page("hoch"), root("hoch")]), "embedded", darkHigh, ["light"]),
    ).toEqual({
      problems: [],
    });
    expect(
      appearanceProblems(embedded([page("hoch"), root("hoch")]), "embedded", darkHigh, ["light", "dark"]),
    ).toEqual({ problems: [] });
    expect(
      appearanceProblems(embedded([page("hoch"), root(null)]), "embedded", darkHigh, ["light"]).problems,
    ).toEqual(["div.cd-shell has no data-cd-kontrast (host page dark + hoch, expected light + hoch)"]);
    expect(
      appearanceProblems(embedded([page(null), root("hoch")]), "embedded", { theme: "dark" }, ["light"])
        .problems,
    ).toEqual(['div.cd-shell has data-cd-kontrast="hoch" (host page dark, expected light)']);
  });

  it("requires the dropdown and tooltip to have been checked and the tokens to be loaded", () => {
    const facts = appearance({
      parts: [part("root", "light", { "--cd-ui-text": "" }), part("zoom", "light", { "--cd-ui-text": "" })],
    });
    expect(appearanceProblems(facts, "ide", darkHigh, ["light"]).problems).toEqual([
      "--cd-ui-text is empty at the shell root: the vendored cd-tokens.generated.css is not loaded",
      "dropdown: not visible when the kit opened it, so its mode was not checked",
      "tooltip: not visible when the kit opened it, so its mode was not checked",
    ]);
  });

  it("expects dark everywhere from a modeler that can show it", () => {
    const facts = appearance({
      themed: [
        { description: "html", isDocument: true, relation: "ancestor", theme: "dark", kontrast: null },
      ],
      parts: appearance().parts.map((entry) => ({ ...entry, colorScheme: "dark" })),
    });
    expect(appearanceProblems(facts, "ide", { theme: "dark" }, ["light", "dark"])).toEqual({ problems: [] });
  });
});

function leftovers(overrides: Partial<LeftoverFacts> = {}): LeftoverFacts {
  return {
    classedElements: [],
    documentClasses: ["cd-shell-document"],
    chromeElements: [],
    rootClasses: [],
    rootAttributes: ["id"],
    errors: [],
    ...overrides,
  };
}

describe("leftoverProblems", () => {
  it("accepts a clean page and the host's own document class", () => {
    expect(leftoverProblems(leftovers(), "ide")).toEqual([]);
  });

  it("reports elements, classes, attributes and errors the shell left", () => {
    const facts = leftovers({
      classedElements: ["div.cd-shell-tooltip"],
      documentClasses: ["cd-shell-document", "cd-shell-no-transition"],
      chromeElements: ['div.cd-shell-zoom[data-chrome="zoom"]'],
      rootClasses: ["cd-shell"],
      rootAttributes: ["id", "data-palette", "data-cd-shell-host"],
      errors: ["ResizeObserver loop completed with undelivered notifications.", "TypeError: x is null"],
    });
    expect(leftoverProblems(facts, "embedded")).toEqual([
      "div.cd-shell-tooltip is left after destroy",
      "<html> keeps the class cd-shell-document after destroy",
      "<html> keeps the class cd-shell-no-transition after destroy",
      'div.cd-shell-zoom[data-chrome="zoom"] is left after destroy',
      "the root keeps the class cd-shell after destroy",
      "the root keeps data-palette after destroy",
      "the root keeps data-cd-shell-host after destroy",
      "the page reported an error after destroy: TypeError: x is null",
    ]);
  });

  it("wants an embedded root to drop its own mode, an own document's root has none to drop", () => {
    const facts = leftovers({ rootAttributes: ["id", "data-cd-theme", "data-cd-kontrast"] });
    expect(leftoverProblems(facts, "embedded")).toEqual([
      "<html> keeps the class cd-shell-document after destroy",
      "the root keeps data-cd-theme after destroy",
      "the root keeps data-cd-kontrast after destroy",
    ]);
    expect(leftoverProblems(facts, "ide")).toEqual([]);
  });
});

describe("afterDestroyKeyProblem", () => {
  const recorded = (defaultPrevented: boolean): RecordedKey[] => [
    {
      key: "=",
      code: "Equal",
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      defaultPrevented,
    },
  ];

  it("wants every chrome key to pass untouched once the shell is gone", () => {
    expect(afterDestroyKeyProblem("Control+Equal", recorded(false))).toBeUndefined();
    expect(afterDestroyKeyProblem("Control+Equal", recorded(true))).toMatch(/still installed/);
    expect(afterDestroyKeyProblem("Control+Equal", [])).toMatch(/still stops it/);
  });
});

describe("absent islands and the harness's own consistency", () => {
  it("names only the islands of absent, never its invalid state", () => {
    expect(absentIslands(["invalid", "inspector", "legend"])).toEqual(["legend", "inspector"]);
    expect(absentIslands(undefined)).toEqual([]);
  });

  it("reports an absent island that shows anyway", () => {
    expect(absentIslandProblems(new Set(["menu", "palette", "legend"]), ["legend", "inspector"])).toEqual([
      "legend: visible, but harness.absent says the modeler has no legend",
    ]);
    expect(absentIslandProblems(new Set(["legend"]), undefined)).toEqual([]);
  });

  it("reports a hook the harness both gives and declares absent", () => {
    const hook = async () => {};
    const harness = {
      host: "ide" as const,
      themes: ["light" as const],
      open: hook,
      show: { legend: hook, invalid: hook },
      absent: ["legend", "inspector", "invalid"] as const,
    };
    expect(harnessHookProblems(harness, ["legend", "inspector", "problems", "status"])).toEqual([
      'harness: absent lists "legend", but show.legend is given',
    ]);
    expect(harnessHookProblems(harness, ["invalid"])).toEqual([
      'harness: absent lists "invalid", but show.invalid is given',
    ]);
  });
});

describe("surroundProblems", () => {
  const grund = "rgb(249, 247, 247)";

  it("accepts a surround painted in --cd-ui-grund", () => {
    expect(
      surroundProblems({
        container: true,
        painted: { description: "div.cd-shell-canvas", color: grund },
        grund,
      }),
    ).toEqual([]);
  });

  it("names the painting element and both colours when the surround leaves the mode", () => {
    expect(
      surroundProblems({
        container: true,
        painted: { description: "div.djs-container", color: "rgb(8, 10, 32)" },
        grund,
      }),
    ).toEqual([
      "canvas surround: div.djs-container paints rgb(8, 10, 32), but --cd-ui-grund resolves to rgb(249, 247, 247); the surround follows the mode (guide §10.1)",
    ]);
  });

  it("wants something to paint the surround, and a canvas to check", () => {
    expect(surroundProblems({ container: true, painted: null, grund })).toEqual([
      expect.stringMatching(/nothing from \.djs-container out to the root paints a background colour/),
    ]);
    expect(surroundProblems({ container: false, painted: null, grund })).toEqual([
      "canvas surround: no .djs-container in the root to check",
    ]);
  });
});

const ROLES = { text: "rgb(29, 29, 29)", interaktion: "rgb(51, 93, 229)", textLeise: "rgb(107, 102, 102)" };

function colorEntry(overrides: Partial<PaletteColorEntry> = {}): PaletteColorEntry {
  return {
    action: "lasso-tool",
    group: "tools",
    pressed: false,
    disabled: false,
    hovered: false,
    color: ROLES.text,
    icon: { kind: "svg", color: ROLES.text },
    ...overrides,
  };
}

function colors(entries: PaletteColorEntry[]): PaletteColorFacts {
  return { roles: ROLES, entries };
}

describe("paletteColorProblems", () => {
  it("tells tools from notation previews by group and action", () => {
    expect(isToolEntry({ action: "lasso-tool", group: "tools" })).toBe(true);
    expect(isToolEntry({ action: "space-tool", group: "edit" })).toBe(true);
    expect(isToolEntry({ action: "drawing", group: "tools" })).toBe(true);
    expect(isToolEntry({ action: "create.box", group: "shapes" })).toBe(false);
  });

  it("accepts text at rest and pressed, interaktion hovered, text-leise disabled", () => {
    expect(
      paletteColorProblems(
        colors([
          colorEntry(),
          colorEntry({ action: "hand-tool", pressed: true }),
          colorEntry({
            action: "space-tool",
            hovered: true,
            color: ROLES.interaktion,
            icon: { kind: "::before", color: ROLES.interaktion },
          }),
          colorEntry({
            action: "drawing-tool",
            pressed: true,
            hovered: true,
            color: ROLES.interaktion,
            icon: { kind: "svg", color: ROLES.interaktion },
          }),
          colorEntry({
            action: "connect-tool",
            disabled: true,
            hovered: true,
            color: ROLES.textLeise,
            icon: null,
          }),
        ]),
      ),
    ).toEqual([]);
  });

  it("exempts notation previews, which keep their colours", () => {
    expect(
      paletteColorProblems(
        colors([colorEntry({ action: "create.box", group: "shapes", color: "rgb(255, 0, 0)", icon: null })]),
      ),
    ).toEqual([]);
  });

  it("reports a renderer colour on the armed tool's icon and on a hovered entry", () => {
    expect(
      paletteColorProblems(
        colors([
          colorEntry({ pressed: true, icon: { kind: "svg", color: "rgb(29, 30, 33)" } }),
          colorEntry({ action: "hand-tool", hovered: true, color: ROLES.text, icon: null }),
          colorEntry({
            action: "space-tool",
            disabled: true,
            icon: { kind: "::before", color: ROLES.textLeise },
          }),
        ]),
      ),
    ).toEqual([
      'palette: the <svg> icon of tool "lasso-tool" pressed has color rgb(29, 30, 33), expected --cd-ui-text (rgb(29, 29, 29)); a renderer rule overrides the skin (guide §5.5)',
      'palette: tool "hand-tool" hovered has color rgb(29, 29, 29), expected --cd-ui-interaktion (rgb(51, 93, 229)) (guide §5.5)',
      'palette: tool "space-tool" aria-disabled has color rgb(29, 29, 29), expected --cd-ui-text-leise (rgb(107, 102, 102)) (guide §5.5)',
    ]);
  });
});

function shape(id: string, overrides: Partial<ShapeFacts> = {}): ShapeFacts {
  return {
    id,
    selected: false,
    transform: "matrix(1 0 0 1 100 100)",
    size: { width: 120, height: 80 },
    box: { left: 580, top: 410, width: 120, height: 80 },
    client: { x: 640, y: 450 },
    hit: true,
    ...overrides,
  };
}

const CANVAS: CanvasStateFacts = {
  focusInCanvas: true,
  focused: "svg",
  contextPadEntries: [],
  textFields: [],
};

function created(overrides: Partial<CreateFacts> = {}): CreateFacts {
  return {
    entry: "create.box",
    before: [shape("a")],
    after: [shape("a"), shape("b", { selected: true })],
    canvas: CANVAS,
    free: { left: 24, top: 88, right: 1256, bottom: 836 },
    ...overrides,
  };
}

describe("createProblems", () => {
  it("accepts one selected element centred in the free rectangle, the canvas focused", () => {
    expect(createProblems(created())).toEqual([]);
  });

  it("reports an Enter that places nothing, or more than one element", () => {
    expect(createProblems(created({ after: [shape("a")] }))).toEqual([
      'create: Enter on palette entry "create.box" added no element; Enter on a creating entry places it in the centre of the free rectangle (guide §5.5)',
    ]);
    expect(createProblems(created({ after: [shape("a"), shape("b"), shape("c")] }))).toEqual([
      'create: Enter on palette entry "create.box" added 2 elements (b, c), expected exactly one',
    ]);
  });

  it("wants the new element selected, the canvas focused and the centre in the free rectangle", () => {
    expect(
      createProblems(
        created({
          after: [shape("a"), shape("b", { box: { left: 0, top: 0, width: 40, height: 40 } })],
          canvas: { ...CANVAS, focusInCanvas: false, focused: 'div.entry[data-action="create.box"]' },
        }),
      ),
    ).toEqual([
      'create: the new element "b" is not selected (guide §5.5)',
      'create: after Enter on palette entry "create.box" the focus is on div.entry[data-action="create.box"], expected the canvas (its <svg> or the label editor, guide §5.5)',
      'create: the new element "b" is centred at (20, 20)px, outside the free rectangle 24–1256 × 88–836px (guide §5.5, §5.9)',
    ]);
  });

  it("allows the geometry tolerance at the free rectangle's edge", () => {
    const atEdge = shape("b", { selected: true, box: { left: 3, top: 67, width: 40, height: 40 } });
    expect(createProblems(created({ after: [shape("a"), atEdge] }))).toEqual([]);
  });
});

describe("read-only checks", () => {
  const status = (role: string, visible = true): ElementFacts => ({
    ...element("div", { "data-chrome": "status", role, "data-severity": "danger" }),
    visible,
  });

  it("wants data-readonly on the root and the status box as an alert", () => {
    expect(readOnlyStateProblems({ readOnly: true, status: status("alert") })).toEqual([]);
    expect(readOnlyStateProblems({ readOnly: false, status: status("status") })).toEqual([
      "read-only: the root has no data-readonly 800ms after show.invalid",
      'read-only: the status box of an invalid file has role "status", expected "alert" (guide §13.5)',
    ]);
    expect(readOnlyStateProblems({ readOnly: true, status: null })).toEqual([
      "read-only: the status box is not visible 800ms after show.invalid (guide §5.12)",
    ]);
  });

  const entry = (action: string, disabled: boolean, group = "tools"): PaletteEntryState => ({
    action,
    group,
    pressed: false,
    disabled,
    client: { x: 0, y: 0 },
  });

  it("wants every palette entry aria-disabled but Lasso and Hand", () => {
    expect(
      readOnlyPaletteProblems([
        entry("lasso-tool", false),
        entry("hand-tool", false),
        entry("space-tool", true),
        entry("create.box", true, "shapes"),
      ]),
    ).toEqual([]);
    expect(
      readOnlyPaletteProblems([
        entry("lasso-tool", true),
        entry("space-tool", false),
        entry("create.box", false, "shapes"),
      ]),
    ).toEqual([
      'palette: "lasso-tool" is aria-disabled on the read-only canvas; Lasso and Hand stay active (guide §13.5)',
      'palette: "space-tool" is not aria-disabled on the read-only canvas (guide §13.5)',
      'palette: "create.box" is not aria-disabled on the read-only canvas (guide §13.5)',
    ]);
  });

  const item = (
    name: string,
    group: "model" | "export" | "help",
    disabled: boolean,
    menuId: string | null = null,
  ): MenuEntryFacts => ({
    name,
    role: menuId === "legend" ? "menuitemcheckbox" : "menuitem",
    menuId,
    disabled,
    group,
  });

  it("keeps the Legend toggle, export and help usable; Model entries may lock", () => {
    const before = [
      item("Snap to grid", "model", false, "snap"),
      item("Legend", "model", false, "legend"),
      item("Export as PNG", "export", false, "export-png"),
      item("Export as SVG", "export", true, "export-svg"),
      item("Keyboard shortcuts…", "help", false, "shortcuts"),
    ];
    const locked = [
      item("Snap to grid", "model", true, "snap"),
      item("Legend", "model", false, "legend"),
      item("Export as PNG", "export", false, "export-png"),
      item("Export as SVG", "export", true, "export-svg"),
      item("Keyboard shortcuts…", "help", false, "shortcuts"),
    ];
    expect(readOnlyMenuProblems(before, locked)).toEqual([]);
    const overLocked = locked.map((entry) => ({ ...entry, disabled: true }));
    expect(readOnlyMenuProblems(before, overLocked)).toEqual([
      "menu: the Legend toggle is aria-disabled on the read-only canvas; a view-only toggle stays usable (guide §13.5)",
      'menu: "Export as PNG" is aria-disabled on the read-only canvas; export and help stay usable (guide §13.5)',
      'menu: "Keyboard shortcuts…" is aria-disabled on the read-only canvas; export and help stay usable (guide §13.5)',
    ]);
  });

  it("tells the groups apart by name, also when the menu has no Model group", () => {
    const before = [
      item("Export as PNG", "export", false, "export-png"),
      item("Keyboard shortcuts…", "help", false, "shortcuts"),
    ];
    const overLocked = before.map((entry) => ({ ...entry, disabled: true }));
    expect(readOnlyMenuProblems(before, overLocked)).toEqual([
      'menu: "Export as PNG" is aria-disabled on the read-only canvas; export and help stay usable (guide §13.5)',
      'menu: "Keyboard shortcuts…" is aria-disabled on the read-only canvas; export and help stay usable (guide §13.5)',
    ]);
  });

  const locked = (overrides: Partial<LockedShapeFacts> = {}): LockedShapeFacts => ({
    contextPadEntries: [],
    dragged: { before: shape("a"), after: shape("a", { client: { x: 700, y: 450 } }) },
    textFields: [],
    kept: { Delete: true, Backspace: true },
    ...overrides,
  });

  it("accepts a shape that only gets selected, also when the canvas pans", () => {
    expect(lockedShapeProblems(locked())).toEqual([]);
  });

  it("reports the context pad, a move, a resize, a label editor and a delete", () => {
    expect(
      lockedShapeProblems(
        locked({
          contextPadEntries: ["delete"],
          dragged: {
            before: shape("a"),
            after: shape("a", { transform: "matrix(1 0 0 1 140 100)", size: { width: 160, height: 80 } }),
          },
          textFields: ["div.djs-direct-editing-content"],
          kept: { Delete: false, Backspace: true },
        }),
      ),
    ).toEqual([
      'read-only: selecting "a" shows the context pad (delete) (guide §13.5)',
      'read-only: a 40px drag changed "a" (transform "matrix(1 0 0 1 100 100)" → "matrix(1 0 0 1 140 100)", 120 × 80 → 160 × 80) (guide §13.5)',
      'read-only: a double-click on "a" opens a text field (div.djs-direct-editing-content) (guide §13.5)',
      'read-only: Delete on the canvas deleted "a" (guide §13.5)',
    ]);
    expect(lockedShapeProblems(locked({ dragged: { before: shape("a"), after: undefined } }))).toEqual([
      'read-only: a 40px drag removed "a" from the canvas (guide §13.5)',
    ]);
  });
});
