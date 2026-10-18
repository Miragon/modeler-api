import { describe, expect, it } from "vitest";

import {
  afterDestroyKeyProblem,
  appearanceProblems,
  ariaProblems,
  expectedAppearance,
  expectedKeyShortcuts,
  keyReachProblem,
  leftoverProblems,
  menuClosedProblems,
  menuOpenProblems,
  optionalIslandProblems,
  type KeyReach,
} from "./checks.js";
import type { AppearanceFacts, AriaFacts, MenuFacts, ModeFacts } from "./facts.js";
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

  it("lets an embedded modeler without attributes stay light, but reports unverified high contrast", () => {
    const facts = appearance({
      documentClasses: [],
      themed: [],
      parts: appearance().parts.map((entry) => ({ ...entry, colorScheme: "normal" })),
    });
    expect(appearanceProblems(facts, "embedded", { theme: "dark" }, ["light"])).toEqual({ problems: [] });
    expect(appearanceProblems(facts, "embedded", darkHigh, ["light"])).toEqual({
      problems: [],
      unverified: "embedded host without data-cd-theme on the root or above it: high contrast not verified",
    });
  });

  it("uses the nearest themed ancestor of an embedded root and ignores the host page's own mode", () => {
    const facts = appearance({
      documentClasses: [],
      themed: [
        { description: "html", isDocument: true, relation: "ancestor", theme: "dark", kontrast: null },
        {
          description: "div.cd-shell",
          isDocument: false,
          relation: "self",
          theme: "light",
          kontrast: "hoch",
        },
      ],
    });
    expect(appearanceProblems(facts, "embedded", darkHigh, ["light"])).toEqual({ problems: [] });
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
