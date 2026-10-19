import { describe, expect, it } from "vitest";
import {
  TEXT_FIELD_SELECTOR,
  ariaKeyShortcuts,
  ariaKeyShortcutsFromLabel,
  commandKeyLabel,
  decideKey,
  detectPlatform,
  isUndoRedoKey,
  matchChromeKey,
  shortcutLabel,
  type ChromeKey,
  type KeyAction,
  type KeyContext,
  type KeyLike,
} from "./keymap.js";
import { defaultMessages } from "./messages.js";
import type { ShellHost } from "./types.js";

function press(key: string, code: string, modifiers: Partial<Omit<KeyLike, "key" | "code">> = {}): KeyLike {
  return { key, code, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...modifiers };
}

const meta = { metaKey: true };
const ctrl = { ctrlKey: true };

describe("matchChromeKey (guide §5.8)", () => {
  const commandCases: [string, KeyLike, ChromeKey][] = [];
  for (const [name, modifier] of [
    ["Meta", meta],
    ["Ctrl", ctrl],
  ] as const) {
    commandCases.push(
      [`${name} + =`, press("=", "Equal", modifier), "zoomIn"],
      [`${name} + Shift + = (key "+")`, press("+", "Equal", { ...modifier, shiftKey: true }), "zoomIn"],
      [`${name} + "+" (German plus key)`, press("+", "BracketRight", modifier), "zoomIn"],
      [
        `${name} + Shift + "=" (key stays "=")`,
        press("=", "Equal", { ...modifier, shiftKey: true }),
        "zoomIn",
      ],
      [`${name} + NumpadAdd`, press("+", "NumpadAdd", modifier), "zoomIn"],
      [`${name} + -`, press("-", "Minus", modifier), "zoomOut"],
      [`${name} + Shift + - (key "_")`, press("_", "Minus", { ...modifier, shiftKey: true }), "zoomOut"],
      [`${name} + "-" (German minus key)`, press("-", "Slash", modifier), "zoomOut"],
      [`${name} + NumpadSubtract`, press("-", "NumpadSubtract", modifier), "zoomOut"],
      [`${name} + 0`, press("0", "Digit0", modifier), "zoomToActual"],
      [`${name} + Numpad0`, press("0", "Numpad0", modifier), "zoomToActual"],
      [
        `${name} + Numpad0 with NumLock off (key "Insert")`,
        press("Insert", "Numpad0", modifier),
        "zoomToActual",
      ],
    );
  }

  it.each(commandCases)("%s → %s", (_, event, expected) => {
    expect(matchChromeKey(event)).toBe(expected);
  });

  it.each([
    ['Shift + 1 on US/German layouts (key "!")', press("!", "Digit1", { shiftKey: true })],
    ['Shift + 1 on AZERTY (key "1")', press("1", "Digit1", { shiftKey: true })],
  ])("%s → fit", (_, event) => {
    expect(matchChromeKey(event)).toBe("fit");
  });

  it.each([
    ["unmodified +", press("+", "Equal", { shiftKey: true })],
    ["unmodified =", press("=", "Equal")],
    ["unmodified -", press("-", "Minus")],
    ["unmodified _", press("_", "Minus", { shiftKey: true })],
    ["unmodified 0", press("0", "Digit0")],
    ["unmodified NumpadAdd", press("+", "NumpadAdd")],
    ["unmodified NumpadSubtract", press("-", "NumpadSubtract")],
    ["unmodified Numpad0", press("0", "Numpad0")],
    ["1 without Shift", press("1", "Digit1")],
    ['"!" from another key (French Slash key)', press("!", "Slash")],
    ["Meta + Shift + 1", press("!", "Digit1", { shiftKey: true, metaKey: true })],
    ["Ctrl + Shift + 1", press("!", "Digit1", { shiftKey: true, ctrlKey: true })],
    ['Ctrl + Shift + 0 (key ")")', press(")", "Digit0", { shiftKey: true, ctrlKey: true })],
    ["Ctrl + 1", press("1", "Digit1", ctrl)],
    ["Ctrl + A", press("a", "KeyA", ctrl)],
  ])("%s → nothing", (_, event) => {
    expect(matchChromeKey(event)).toBeUndefined();
  });

  it.each([
    ["Ctrl + Alt + = (AltGr)", press("=", "Equal", { ctrlKey: true, altKey: true })],
    ["Ctrl + Alt + - (AltGr)", press("-", "Minus", { ctrlKey: true, altKey: true })],
    ["Ctrl + Alt + 0 (AltGr)", press("0", "Digit0", { ctrlKey: true, altKey: true })],
    ["Meta + Alt + NumpadAdd", press("+", "NumpadAdd", { metaKey: true, altKey: true })],
    ["Alt + Shift + 1", press("!", "Digit1", { shiftKey: true, altKey: true })],
  ])("never with Alt: %s", (_, event) => {
    expect(matchChromeKey(event)).toBeUndefined();
  });
});

describe("isUndoRedoKey", () => {
  it.each([
    ["Meta + Z", press("z", "KeyZ", meta)],
    ["Ctrl + Z", press("z", "KeyZ", ctrl)],
    ["Meta + Shift + Z", press("z", "KeyZ", { metaKey: true, shiftKey: true })],
    ['Ctrl + Shift + Z (key "Z")', press("Z", "KeyZ", { ctrlKey: true, shiftKey: true })],
    ["Ctrl + Y", press("y", "KeyY", ctrl)],
    ["Meta + Y", press("y", "KeyY", meta)],
    ["QWERTZ Ctrl + Z (physical KeyY)", press("z", "KeyY", ctrl)],
    ["QWERTZ Ctrl + Y (physical KeyZ)", press("y", "KeyZ", ctrl)],
    ["Cyrillic Ctrl + Я (physical KeyZ)", press("я", "KeyZ", ctrl)],
    ["Cyrillic Ctrl + Н (physical KeyY)", press("н", "KeyY", ctrl)],
  ])("%s is undo/redo", (_, event) => {
    expect(isUndoRedoKey(event)).toBe(true);
  });

  it.each([
    ["Z alone", press("z", "KeyZ")],
    ["Shift + Z", press("Z", "KeyZ", { shiftKey: true })],
    ["Ctrl + Alt + Z", press("z", "KeyZ", { ctrlKey: true, altKey: true })],
    ["Ctrl + Shift + Y (VS Code: Debug Console)", press("Y", "KeyY", { ctrlKey: true, shiftKey: true })],
    ["Ctrl + A", press("a", "KeyA", ctrl)],
    ["Dvorak Ctrl + ; (physical KeyZ)", press(";", "KeyZ", ctrl)],
    ["Ctrl + =", press("=", "Equal", ctrl)],
  ])("%s is not", (_, event) => {
    expect(isUndoRedoKey(event)).toBe(false);
  });
});

describe("TEXT_FIELD_SELECTOR", () => {
  it("covers inputs, select lists and editable text", () => {
    expect(TEXT_FIELD_SELECTOR).toBe(
      "input, textarea, select, [contenteditable]:not([contenteditable='false'])",
    );
  });
});

describe("decideKey (guide §5.8, §13.5)", () => {
  const nothingOpen: KeyContext = {
    host: "ide",
    inTextField: false,
    menuOpen: false,
    dialogOpen: false,
    modalOpen: false,
    defaultPrevented: false,
  };

  const escape = press("Escape", "Escape");
  const zoomIn = press("=", "Equal", meta);
  const fit = press("!", "Digit1", { shiftKey: true });
  const composing = (event: KeyLike): KeyLike => ({ ...event, isComposing: true });

  interface Row {
    name: string;
    event: KeyLike;
    context?: Partial<KeyContext>;
    action?: KeyAction;
    preventDefault: boolean;
    /** stopPropagation in the IDE host; web and embedded never stop. */
    stopInIde: boolean;
  }

  const rows: Row[] = [
    // Escape
    {
      name: "Escape, menu open",
      event: escape,
      context: { menuOpen: true },
      action: "closeMenu",
      preventDefault: true,
      stopInIde: true,
    },
    {
      name: "Escape, menu open, while composing",
      event: composing(escape),
      context: { menuOpen: true },
      preventDefault: false,
      stopInIde: true,
    },
    {
      name: "Escape, popover open",
      event: escape,
      context: { dialogOpen: true },
      preventDefault: false,
      stopInIde: true,
    },
    {
      name: "Escape, modal dialog open",
      event: escape,
      context: { dialogOpen: true, modalOpen: true },
      preventDefault: false,
      stopInIde: true,
    },
    {
      name: "Escape, popover open, in its text field",
      event: escape,
      context: { dialogOpen: true, inTextField: true },
      preventDefault: false,
      stopInIde: true,
    },
    { name: "Escape, nothing open", event: escape, preventDefault: false, stopInIde: false },
    {
      name: "Escape, nothing open, handled by the canvas",
      event: escape,
      context: { defaultPrevented: true },
      preventDefault: false,
      stopInIde: true,
    },
    {
      name: "Shift + Escape, menu open",
      event: press("Escape", "Escape", { shiftKey: true }),
      context: { menuOpen: true },
      preventDefault: false,
      stopInIde: false,
    },
    {
      name: "Meta + Escape, popover open",
      event: press("Escape", "Escape", meta),
      context: { dialogOpen: true },
      preventDefault: false,
      stopInIde: false,
    },

    // zoom keys
    { name: "Meta + =", event: zoomIn, action: "zoomIn", preventDefault: true, stopInIde: true },
    {
      name: 'Ctrl + Shift + = ("+")',
      event: press("+", "Equal", { ctrlKey: true, shiftKey: true }),
      action: "zoomIn",
      preventDefault: true,
      stopInIde: true,
    },
    {
      name: "Ctrl + NumpadAdd",
      event: press("+", "NumpadAdd", ctrl),
      action: "zoomIn",
      preventDefault: true,
      stopInIde: true,
    },
    {
      name: "Meta + -",
      event: press("-", "Minus", meta),
      action: "zoomOut",
      preventDefault: true,
      stopInIde: true,
    },
    {
      name: 'Meta + Shift + - ("_")',
      event: press("_", "Minus", { metaKey: true, shiftKey: true }),
      action: "zoomOut",
      preventDefault: true,
      stopInIde: true,
    },
    {
      name: "Ctrl + NumpadSubtract",
      event: press("-", "NumpadSubtract", ctrl),
      action: "zoomOut",
      preventDefault: true,
      stopInIde: true,
    },
    {
      name: "Meta + 0",
      event: press("0", "Digit0", meta),
      action: "zoomToActual",
      preventDefault: true,
      stopInIde: true,
    },
    {
      name: 'Ctrl + Numpad0 ("Insert")',
      event: press("Insert", "Numpad0", ctrl),
      action: "zoomToActual",
      preventDefault: true,
      stopInIde: true,
    },
    {
      name: "zoom key already prevented by the diagram-js keyboard",
      event: zoomIn,
      context: { defaultPrevented: true },
      action: "zoomIn",
      preventDefault: true,
      stopInIde: true,
    },
    {
      name: "zoom key with the menu open",
      event: zoomIn,
      context: { menuOpen: true },
      action: "zoomIn",
      preventDefault: true,
      stopInIde: true,
    },
    {
      name: "zoom key with a popover open",
      event: zoomIn,
      context: { dialogOpen: true },
      action: "zoomIn",
      preventDefault: true,
      stopInIde: true,
    },
    {
      name: "zoom key in a text field",
      event: zoomIn,
      context: { inTextField: true },
      preventDefault: false,
      stopInIde: true,
    },
    { name: "zoom key while composing", event: composing(zoomIn), preventDefault: false, stopInIde: true },
    {
      name: "zoom key with a modal dialog",
      event: zoomIn,
      context: { dialogOpen: true, modalOpen: true },
      preventDefault: false,
      stopInIde: true,
    },
    {
      name: "Meta + 0 in a text field",
      event: press("0", "Digit0", meta),
      context: { inTextField: true },
      preventDefault: false,
      stopInIde: true,
    },

    // Shift + 1
    { name: "Shift + 1", event: fit, action: "fit", preventDefault: true, stopInIde: true },
    {
      name: "Shift + 1 on AZERTY",
      event: press("1", "Digit1", { shiftKey: true }),
      action: "fit",
      preventDefault: true,
      stopInIde: true,
    },
    {
      name: "Shift + 1 already prevented by the diagram-js keyboard",
      event: fit,
      context: { defaultPrevented: true },
      action: "fit",
      preventDefault: true,
      stopInIde: true,
    },
    {
      name: "Shift + 1 with the menu open",
      event: fit,
      context: { menuOpen: true },
      action: "fit",
      preventDefault: true,
      stopInIde: true,
    },
    {
      name: 'Shift + 1 in a text field types "!"',
      event: fit,
      context: { inTextField: true },
      preventDefault: false,
      stopInIde: false,
    },
    {
      name: "Shift + 1 in a text field, prevented there",
      event: fit,
      context: { inTextField: true, defaultPrevented: true },
      preventDefault: false,
      stopInIde: false,
    },
    { name: "Shift + 1 while composing", event: composing(fit), preventDefault: false, stopInIde: false },
    {
      name: "Shift + 1 with a modal dialog",
      event: fit,
      context: { dialogOpen: true, modalOpen: true },
      preventDefault: false,
      stopInIde: false,
    },

    // undo and redo
    {
      name: "Meta + Z in a text field",
      event: press("z", "KeyZ", meta),
      context: { inTextField: true },
      preventDefault: false,
      stopInIde: true,
    },
    {
      name: "Ctrl + Shift + Z in a text field",
      event: press("Z", "KeyZ", { ctrlKey: true, shiftKey: true }),
      context: { inTextField: true },
      preventDefault: false,
      stopInIde: true,
    },
    {
      name: "Ctrl + Y in a text field",
      event: press("y", "KeyY", ctrl),
      context: { inTextField: true },
      preventDefault: false,
      stopInIde: true,
    },
    {
      name: "Meta + Z on the canvas, unhandled (VS Code undoes the document)",
      event: press("z", "KeyZ", meta),
      preventDefault: false,
      stopInIde: false,
    },
    {
      name: "Meta + Z on the canvas, handled by the modeler",
      event: press("z", "KeyZ", meta),
      context: { defaultPrevented: true },
      preventDefault: false,
      stopInIde: true,
    },

    // every other key
    {
      name: "Meta + A handled by the canvas",
      event: press("a", "KeyA", meta),
      context: { defaultPrevented: true },
      preventDefault: false,
      stopInIde: true,
    },
    {
      name: "Meta + C handled by the canvas",
      event: press("c", "KeyC", meta),
      context: { defaultPrevented: true },
      preventDefault: false,
      stopInIde: true,
    },
    { name: "Meta + A unhandled", event: press("a", "KeyA", meta), preventDefault: false, stopInIde: false },
    { name: "Meta + S", event: press("s", "KeyS", meta), preventDefault: false, stopInIde: false },
    { name: "F1", event: press("F1", "F1"), preventDefault: false, stopInIde: false },
    {
      name: "unmodified +",
      event: press("+", "Equal", { shiftKey: true }),
      preventDefault: false,
      stopInIde: false,
    },
    {
      name: "unmodified + handled by the modeler",
      event: press("+", "Equal", { shiftKey: true }),
      context: { defaultPrevented: true },
      preventDefault: false,
      stopInIde: true,
    },
    {
      name: "Ctrl + Alt + = (AltGr)",
      event: press("=", "Equal", { ctrlKey: true, altKey: true }),
      preventDefault: false,
      stopInIde: false,
    },
    {
      name: "a letter in a text field",
      event: press("a", "KeyA"),
      context: { inTextField: true },
      preventDefault: false,
      stopInIde: false,
    },
  ];

  const hosts: ShellHost[] = ["ide", "web", "embedded"];
  const cases = hosts.flatMap((host) => rows.map((row) => [host, row.name, row] as const));

  it.each(cases)("%s: %s", (host, _, row) => {
    const expected = {
      ...(row.action ? { action: row.action } : {}),
      preventDefault: row.preventDefault,
      stopPropagation: host === "ide" && row.stopInIde,
    };
    expect(decideKey(row.event, { ...nothingOpen, ...row.context, host })).toStrictEqual(expected);
  });

  it("leaves the zoom keys and Shift + 1 to the browser behind the web app's start screen", () => {
    const startScreen: KeyContext = { ...nothingOpen, host: "web", startScreen: true };
    for (const event of [zoomIn, press("-", "Minus", meta), press("0", "Digit0", meta), fit]) {
      expect(decideKey(event, startScreen)).toEqual({ preventDefault: false, stopPropagation: false });
    }
    expect(decideKey(escape, { ...startScreen, menuOpen: true })).toEqual({
      action: "closeMenu",
      preventDefault: true,
      stopPropagation: false,
    });
    expect(decideKey(zoomIn, { ...startScreen, startScreen: false })).toEqual({
      action: "zoomIn",
      preventDefault: true,
      stopPropagation: false,
    });
    // The IDE host has no start screen; its zoom keys never reach VS Code.
    expect(decideKey(zoomIn, { ...nothingOpen, startScreen: true })).toMatchObject({ stopPropagation: true });
  });
});

describe("commandKeyLabel", () => {
  it("writes ⌘ on macOS and the localized Ctrl elsewhere", () => {
    expect(commandKeyLabel("O", "mac", defaultMessages.keyNames)).toBe("⌘O");
    expect(commandKeyLabel("S", "other", defaultMessages.keyNames)).toBe("Ctrl+S");
    expect(commandKeyLabel("O", "other", { ctrl: "Strg" })).toBe("Strg+O");
  });

  it("gives labels that name the same keys for aria-keyshortcuts", () => {
    expect(ariaKeyShortcutsFromLabel(commandKeyLabel("O", "mac", defaultMessages.keyNames))).toBe("Meta+O");
    expect(ariaKeyShortcutsFromLabel(commandKeyLabel("S", "other", defaultMessages.keyNames))).toBe(
      "Control+S",
    );
  });
});

describe("detectPlatform", () => {
  it("is other without a navigator", () => {
    expect(detectPlatform()).toBe("other");
    expect(detectPlatform({})).toBe("other");
  });

  it("reads navigator.platform", () => {
    expect(detectPlatform({ platform: "MacIntel" })).toBe("mac");
    expect(detectPlatform({ platform: "Win32" })).toBe("other");
    expect(detectPlatform({ platform: "Linux x86_64" })).toBe("other");
  });

  it("prefers userAgentData", () => {
    expect(detectPlatform({ userAgentData: { platform: "macOS" }, platform: "Win32" })).toBe("mac");
    expect(detectPlatform({ userAgentData: { platform: "Windows" }, platform: "MacIntel" })).toBe("other");
  });

  it("falls back to navigator.platform when userAgentData does not know", () => {
    expect(detectPlatform({ userAgentData: { platform: "" }, platform: "MacIntel" })).toBe("mac");
    expect(detectPlatform({ userAgentData: {}, platform: "MacIntel" })).toBe("mac");
  });
});

describe("shortcut labels", () => {
  const germanKeyNames = { ctrl: "Strg", shift: "Umschalt", plus: "Plus", minus: "Minus" };

  it("use the macOS symbols, with U+2212 for minus", () => {
    const labels = (["zoomIn", "zoomOut", "zoomToActual", "fit"] as const).map((key) =>
      shortcutLabel(key, "mac", defaultMessages.keyNames),
    );
    expect(labels).toEqual(["⌘+", "⌘−", "⌘0", "⇧1"]);
    expect(shortcutLabel("zoomOut", "mac", germanKeyNames)).toBe("⌘−");
  });

  it("spell the keys out elsewhere", () => {
    expect(shortcutLabel("zoomIn", "other", defaultMessages.keyNames)).toBe("Ctrl+Plus");
    expect(shortcutLabel("zoomOut", "other", defaultMessages.keyNames)).toBe("Ctrl+Minus");
    expect(shortcutLabel("zoomToActual", "other", defaultMessages.keyNames)).toBe("Ctrl+0");
    expect(shortcutLabel("fit", "other", defaultMessages.keyNames)).toBe("Shift+1");
  });

  it("take the key names of a localized table", () => {
    expect(shortcutLabel("zoomIn", "other", germanKeyNames)).toBe("Strg+Plus");
    expect(shortcutLabel("zoomOut", "other", germanKeyNames)).toBe("Strg+Minus");
    expect(shortcutLabel("zoomToActual", "other", germanKeyNames)).toBe("Strg+0");
    expect(shortcutLabel("fit", "other", germanKeyNames)).toBe("Umschalt+1");
  });
});

describe("ariaKeyShortcuts", () => {
  it("use WAI-ARIA key names with Meta on macOS", () => {
    expect(ariaKeyShortcuts("zoomIn", "mac")).toBe("Meta+= Meta+Plus");
    expect(ariaKeyShortcuts("zoomOut", "mac")).toBe("Meta+-");
    expect(ariaKeyShortcuts("zoomToActual", "mac")).toBe("Meta+0");
    expect(ariaKeyShortcuts("fit", "mac")).toBe("Shift+1");
  });

  it("use Control elsewhere", () => {
    expect(ariaKeyShortcuts("zoomIn", "other")).toBe("Control+= Control+Plus");
    expect(ariaKeyShortcuts("zoomOut", "other")).toBe("Control+-");
    expect(ariaKeyShortcuts("zoomToActual", "other")).toBe("Control+0");
    expect(ariaKeyShortcuts("fit", "other")).toBe("Shift+1");
  });
});

describe("ariaKeyShortcutsFromLabel", () => {
  it.each([
    ["L", "L"],
    ["l", "L"],
    ["⇧L", "Shift+L"],
    ["⌘⇧Z", "Meta+Shift+Z"],
    ["⌥⌘K", "Alt+Meta+K"],
    ["Ctrl+Shift+E", "Control+Shift+E"],
    ["Strg+Umschalt+E", "Control+Shift+E"],
    ["Shift+1", "Shift+1"],
    ["Ctrl++", "Control+Plus"],
    ["Del", "Delete"],
    ["Esc", "Escape"],
    ["Space", "Space"],
    ["?", "?"],
    ["F2", "F2"],
    ["⇧ L", "Shift+L"],
  ])("maps the chip %j to %j", (label, expected) => {
    expect(ariaKeyShortcutsFromLabel(label)).toBe(expected);
  });

  it.each(["", "  ", "G then D", "1–9", "⌘", "Hyper+K", "Ctrl+"])("gives nothing for %j", (label) => {
    expect(ariaKeyShortcutsFromLabel(label)).toBeUndefined();
  });
});
