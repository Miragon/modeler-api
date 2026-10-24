import type { ShellMessages } from "./messages.js";
import type { ShellHost } from "./types.js";

/** The only keys the chrome handles (guide §5.8). */
export type ChromeKey = "zoomIn" | "zoomOut" | "zoomToActual" | "fit";

/** The `KeyboardEvent` fields the keymap reads. */
export interface KeyLike {
  key: string;
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  isComposing?: boolean | undefined;
}

/**
 * Which chrome key `event` is, ignoring where it was pressed:
 * - `zoomIn`: Cmd/Ctrl + `+` or `=` (by `key`, with or without Shift), or `NumpadAdd` (by `code`);
 * - `zoomOut`: Cmd/Ctrl + `-` or `_`, or `NumpadSubtract`;
 * - `zoomToActual`: Cmd/Ctrl + `0`, or `Numpad0` (also with NumLock off);
 * - `fit`: Shift + `Digit1` (by `code`, every layout) without Cmd, Ctrl or Alt.
 * Cmd/Ctrl is `metaKey || ctrlKey` on every platform; nothing matches with `altKey` (AltGr).
 */
export function matchChromeKey(event: KeyLike): ChromeKey | undefined {
  if (event.altKey) return undefined;
  if (isCommand(event)) {
    if (event.key === "+" || event.key === "=" || event.code === "NumpadAdd") return "zoomIn";
    if (event.key === "-" || event.key === "_" || event.code === "NumpadSubtract") return "zoomOut";
    if (event.key === "0" || event.code === "Numpad0") return "zoomToActual";
    return undefined;
  }
  return event.shiftKey && event.code === "Digit1" ? "fit" : undefined;
}

function isCommand(event: KeyLike): boolean {
  return event.metaKey || event.ctrlKey;
}

/**
 * Cmd/Ctrl + Z, Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y, without Alt (by `key`, `code` as fallback).
 * Cmd/Ctrl + Shift + Y is not redo (VS Code toggles its Debug Console with it).
 */
export function isUndoRedoKey(event: KeyLike): boolean {
  if (event.altKey || !isCommand(event)) return false;
  const letter = undoRedoLetter(event);
  return letter === "z" || (letter === "y" && !event.shiftKey);
}

// The produced character decides on Latin layouts (QWERTZ swaps the Y and Z keys); only where the
// layout produces no ASCII character (Cyrillic, Greek, …) the physical key stands in.
function undoRedoLetter(event: KeyLike): string | undefined {
  if (event.key.length === 1 && event.key.charCodeAt(0) < 0x80) return event.key.toLowerCase();
  if (event.code === "KeyZ") return "z";
  if (event.code === "KeyY") return "y";
  return undefined;
}

/**
 * The elements that are text fields: every input, select list and editable text (label editor,
 * inspector, dialogs). Not the whole rule: test a key's target with `isTextField`, which also counts
 * EditContext editors and Monaco.
 */
export const TEXT_FIELD_SELECTOR =
  "input, textarea, select, [contenteditable]:not([contenteditable='false'])";

// Monaco types into an EditContext element or a textarea; the rest of the editor (the buttons of its
// find widget, its hovers) keeps its keys as well.
const CODE_EDITOR_SELECTOR = ".monaco-editor";

/**
 * What `isTextField` reads of a key's target: an `HTMLElement` has `closest` and
 * `isContentEditable`, in Chromium also `editContext`; an SVG element has only `closest`.
 */
interface TextFieldTargetLike {
  readonly isContentEditable?: unknown;
  readonly editContext?: unknown;
  closest(selectors: string): unknown;
}

function isElementLike(target: unknown): target is TextFieldTargetLike {
  return (
    typeof target === "object" &&
    target !== null &&
    typeof (target as { closest?: unknown }).closest === "function"
  );
}

/**
 * Whether a key's target is a text field (guide §5.8), where the chrome keys do not act: it matches
 * `TEXT_FIELD_SELECTOR` or sits inside a match, is `isContentEditable`, edits through an
 * `EditContext` (`editContext` is set) or sits inside a Monaco editor (`.monaco-editor`). Reads the
 * target structurally, so it needs no DOM; `false` for `null`, `window` and `document`.
 */
export function isTextField(target: unknown): boolean {
  if (!isElementLike(target)) return false;
  return (
    target.isContentEditable === true ||
    (target.editContext !== undefined && target.editContext !== null) ||
    target.closest(`${TEXT_FIELD_SELECTOR}, ${CODE_EDITOR_SELECTOR}`) !== null
  );
}

/** Where a key was pressed, as the shell's one `keydown` listener sees it. */
export interface KeyContext {
  host: ShellHost;
  /** `isTextField(event.target)`. */
  inTextField: boolean;
  /** The shell's menu dropdown is open. */
  menuOpen: boolean;
  /** A popover or dialog (`[role="dialog"]`, modal or not) is open. */
  dialogOpen: boolean;
  /** A modal dialog (`[role="dialog"][aria-modal="true"]`) is open: chrome keys do not act. */
  modalOpen: boolean;
  /** `event.defaultPrevented` when the listener ran: the canvas (or the modeler) handled the key. */
  defaultPrevented: boolean;
  /**
   * The web app's start screen shows (`setEmptyState(true)`): there is no diagram to zoom, so the
   * zoom keys and Shift+1 are left to the browser, which zooms the page.
   */
  startScreen?: boolean | undefined;
}

export type KeyAction = ChromeKey | "closeMenu";

export interface KeyDecision {
  /** What the shell executes; `undefined` = nothing. */
  action?: KeyAction;
  preventDefault: boolean;
  stopPropagation: boolean;
}

/**
 * The key rules of guide §5.8 and §13.5 in one place:
 * 1. Escape with the menu open: `closeMenu`, prevented; in the IDE host stopped whenever the menu
 *    or a dialog/popover is open. During IME composition Escape belongs to the IME: no `closeMenu`.
 * 2. Zoom keys: executed and prevented unless composing, in a text field or with a modal dialog;
 *    in the IDE host always stopped, also when not executed (VS Code must never zoom the window).
 *    Behind the web app's start screen untouched: the browser zooms the page (WCAG 1.4.4).
 * 3. Shift+1: `fit` under the same conditions; otherwise untouched (it types "!").
 * 4. IDE host, text field, undo/redo key: stopped only (the field keeps its native undo).
 * 5. IDE host, `defaultPrevented`: stopped (the canvas handled it; VS Code must not run it again).
 * Everything else passes untouched. `stopPropagation` is only ever true in the IDE host.
 */
export function decideKey(event: KeyLike, context: KeyContext): KeyDecision {
  const stop = context.host === "ide";
  const composing = event.isComposing === true;

  if (
    event.key === "Escape" &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.shiftKey
  ) {
    if (context.menuOpen && !composing) {
      return { action: "closeMenu", preventDefault: true, stopPropagation: stop };
    }
    if (context.menuOpen || context.dialogOpen)
      return { preventDefault: false, stopPropagation: stop };
  }

  const chromeKey = matchChromeKey(event);
  if (chromeKey !== undefined) {
    if (context.startScreen === true && !stop)
      return { preventDefault: false, stopPropagation: false };
    const blocked = composing || context.inTextField || context.modalOpen;
    if (!blocked) return { action: chromeKey, preventDefault: true, stopPropagation: stop };
    // Blocked zoom keys are still kept from VS Code (it would zoom the window); a blocked Shift+1
    // is a character and travels on like any other.
    return { preventDefault: false, stopPropagation: chromeKey === "fit" ? false : stop };
  }

  if (context.inTextField && isUndoRedoKey(event))
    return { preventDefault: false, stopPropagation: stop };
  if (context.defaultPrevented) return { preventDefault: false, stopPropagation: stop };
  return { preventDefault: false, stopPropagation: false };
}

/** The keyboard the user sits at; decides the shortcut labels (guide §5.8). */
export type Platform = "mac" | "other";

/** The `navigator` fields `detectPlatform` reads. */
export interface NavigatorLike {
  platform?: string | undefined;
  userAgentData?: { platform?: string | undefined } | undefined;
}

/**
 * `mac` when `userAgentData.platform ?? platform` matches `/mac/i`, else `other`; `other` without a
 * navigator. Read it in the webview or page itself, never from the extension host (VS Code Remote).
 */
export function detectPlatform(navigator?: NavigatorLike | undefined): Platform {
  // An empty userAgentData.platform means "unknown", not "not a Mac": fall back to navigator.platform.
  const platform = navigator?.userAgentData?.platform || navigator?.platform || "";
  return /mac/i.test(platform) ? "mac" : "other";
}

/**
 * The tooltip chip text: macOS `⌘+`, `⌘−` (U+2212), `⌘0`, `⇧1`; elsewhere `Ctrl+Plus`,
 * `Ctrl+Minus`, `Ctrl+0`, `Shift+1` with the key names of the messages table.
 */
export function shortcutLabel(
  key: ChromeKey,
  platform: Platform,
  keyNames: ShellMessages["keyNames"],
): string {
  if (platform === "mac") return MAC_SHORTCUT_LABELS[key];
  switch (key) {
    case "zoomIn":
      return `${keyNames.ctrl}+${keyNames.plus}`;
    case "zoomOut":
      return `${keyNames.ctrl}+${keyNames.minus}`;
    case "zoomToActual":
      return `${keyNames.ctrl}+0`;
    case "fit":
      return `${keyNames.shift}+1`;
  }
}

/**
 * The chip of a Cmd/Ctrl key a modeler binds itself (the web app's File entries, guide §5.4): macOS
 * `⌘O`, elsewhere `Ctrl+O` with the key name of the messages table (`Strg+O`). `key` as printed on
 * the key cap; pass the result to `FileMenuAction.shortcut` or `MenuActionEntry.shortcut`.
 */
export function commandKeyLabel(
  key: string,
  platform: Platform,
  keyNames: Pick<ShellMessages["keyNames"], "ctrl">,
): string {
  return platform === "mac" ? `⌘${key}` : `${keyNames.ctrl}+${key}`;
}

const MAC_SHORTCUT_LABELS: Readonly<Record<ChromeKey, string>> = {
  zoomIn: "⌘+",
  zoomOut: "⌘\u2212",
  zoomToActual: "⌘0",
  fit: "⇧1",
};

/**
 * The `aria-keyshortcuts` value (WAI-ARIA names): zoom in `Meta+= Meta+Plus`, zoom out `Meta+-`,
 * 100 % `Meta+0`, fit `Shift+1`; outside macOS `Control` instead of `Meta`.
 */
export function ariaKeyShortcuts(key: ChromeKey, platform: Platform): string {
  const command = platform === "mac" ? "Meta" : "Control";
  switch (key) {
    case "zoomIn":
      return `${command}+= ${command}+Plus`;
    case "zoomOut":
      return `${command}+-`;
    case "zoomToActual":
      return `${command}+0`;
    case "fit":
      return "Shift+1";
  }
}

const MAC_MODIFIER_SYMBOLS: Readonly<Record<string, string>> = {
  "⌘": "Meta",
  "⇧": "Shift",
  "⌥": "Alt",
  "⌃": "Control",
};

const MODIFIER_NAMES: Readonly<Record<string, string>> = {
  cmd: "Meta",
  command: "Meta",
  meta: "Meta",
  ctrl: "Control",
  control: "Control",
  strg: "Control",
  shift: "Shift",
  umschalt: "Shift",
  alt: "Alt",
  option: "Alt",
  opt: "Alt",
};

const NAMED_KEYS: Readonly<Record<string, string>> = {
  esc: "Escape",
  escape: "Escape",
  del: "Delete",
  delete: "Delete",
  entf: "Delete",
  backspace: "Backspace",
  enter: "Enter",
  return: "Enter",
  tab: "Tab",
  space: "Space",
  home: "Home",
  end: "End",
  pageup: "PageUp",
  pagedown: "PageDown",
  arrowup: "ArrowUp",
  arrowdown: "ArrowDown",
  arrowleft: "ArrowLeft",
  arrowright: "ArrowRight",
  "↑": "ArrowUp",
  "↓": "ArrowDown",
  "←": "ArrowLeft",
  "→": "ArrowRight",
};

/** How a chip spells a character key: the zoom panel's "Plus" and "Minus", and the "−" of `⌘−`. */
const CHARACTER_SPELLINGS: Readonly<Record<string, string>> = {
  plus: "+",
  minus: "-",
  "\u2212": "-",
};

/** The key that types a character on one layout, named as without ⇧, and whether ⇧ is held. */
interface LayoutKey {
  key: string;
  shift: boolean;
}

const unshifted = (key: string): LayoutKey => ({ key, shift: false });
const shifted = (key: string): LayoutKey => ({ key, shift: true });

/**
 * Every printable character that needs ⇧ on the US or the German main layout, with the keys that
 * type it there, US first (guide §5.6, design system 1.21.0). The German "ß" keeps its case, as the
 * key is called; the plus key is `Plus` (WAI-ARIA).
 */
const SHIFTED_CHARACTER_KEYS: Readonly<
  Record<string, readonly [us: LayoutKey, german: LayoutKey]>
> = {
  "!": [shifted("1"), shifted("1")],
  '"': [shifted("'"), shifted("2")],
  "#": [shifted("3"), unshifted("#")],
  $: [shifted("4"), shifted("4")],
  "%": [shifted("5"), shifted("5")],
  "&": [shifted("7"), shifted("6")],
  "'": [unshifted("'"), shifted("#")],
  "(": [shifted("9"), shifted("8")],
  ")": [shifted("0"), shifted("9")],
  "*": [shifted("8"), shifted("Plus")],
  "+": [shifted("="), unshifted("Plus")],
  "/": [unshifted("/"), shifted("7")],
  ":": [shifted(";"), shifted(".")],
  ";": [unshifted(";"), shifted(",")],
  "<": [shifted(","), unshifted("<")],
  "=": [unshifted("="), shifted("0")],
  ">": [shifted("."), shifted("<")],
  "?": [shifted("/"), shifted("ß")],
  _: [shifted("-"), shifted("-")],
};

// The tables are plain objects: a chip such as "constructor" must not find Object.prototype.
function lookUp<T>(table: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined;
}

/**
 * A key both layouts name alike and reach without ⇧: a named key, a function key, a letter, a
 * digit, the space bar, "," "." or "-". Every other character needs AltGr or ⌥ in one of them
 * (`@`, `[`, `\`), sits on a dead key (`^`, `` ` ``) or is missing there (`ß`, `ä`, `§`): no key to
 * name.
 */
function sameKeyName(key: string): string | undefined {
  const named = lookUp(NAMED_KEYS, key.toLowerCase());
  if (named) return named;
  if (/^f\d{1,2}$/i.test(key)) return key.toUpperCase();
  if (key === " ") return "Space";
  return /^[a-z0-9,.-]$/i.test(key) ? key.toUpperCase() : undefined;
}

function combination(modifiers: readonly string[], key: string): string {
  return [...new Set(modifiers), key].join("+");
}

// The chrome zooms in on Cmd/Ctrl with "+" or "=" (matchChromeKey), so US keyboards need no ⇧
// for it: such a chip names the zoom panel's keys.
function zoomInKeyShortcuts(modifiers: readonly string[], character: string): string | undefined {
  const [command] = modifiers;
  if (modifiers.length !== 1 || (command !== "Meta" && command !== "Control")) return undefined;
  return character === "+" || character === "=" ? `${command}+= ${command}+Plus` : undefined;
}

/** A chip label as one key combination; `key` is `"+"` for "Plus" and `"-"` for "−" or "Minus". */
interface ChipKey {
  modifiers: readonly string[];
  key: string;
}

function parseChipLabel(label: string): ChipKey | undefined {
  let rest = label.trim();
  const modifiers: string[] = [];
  for (let symbol = lookUp(MAC_MODIFIER_SYMBOLS, rest.charAt(0)); symbol && rest.length > 1;) {
    modifiers.push(symbol);
    rest = rest.slice(1).trim();
    symbol = lookUp(MAC_MODIFIER_SYMBOLS, rest.charAt(0));
  }
  if (!rest) return undefined;
  const parts = rest.split("+").map((part) => part.trim());
  if (parts.some((part) => /\s/.test(part))) return undefined;
  let key = parts.pop() ?? "";
  if (key === "" && parts.at(-1) === "") {
    parts.pop();
    key = "+";
  }
  for (const part of parts) {
    const modifier = lookUp(MODIFIER_NAMES, part.toLowerCase());
    if (!modifier) return undefined;
    modifiers.push(modifier);
  }
  return {
    modifiers: [...new Set(modifiers)],
    key: lookUp(CHARACTER_SPELLINGS, key.toLowerCase()) ?? key,
  };
}

/**
 * The `aria-keyshortcuts` value (WAI-ARIA names, guide §5.6) for a shortcut chip label: the keys,
 * not the character. `"L"` → `"L"`, `"⇧L"` → `"Shift+L"`, `"⌘⇧Z"` → `"Meta+Shift+Z"`,
 * `"Ctrl+Shift+E"` → `"Control+Shift+E"`, `"Del"` → `"Delete"`. A character that needs ⇧ on the
 * US or the German layout names the keys of both, US first, once where they agree (design system
 * 1.21.0): `"?"` → `"Shift+/ Shift+ß"`, `"/"` → `"/ Shift+7"`,
 * `"⌘?"` → `"Meta+Shift+/ Meta+Shift+ß"`, `"!"` → `"Shift+1"`; the zoom-in chip `"⌘+"` or
 * `"Ctrl+Plus"` gives the zoom panel's `"Meta+= Meta+Plus"` or `"Control+= Control+Plus"`.
 * `undefined` for a label that is not one key combination (`"G then D"`, `"1–9"`, empty) and for a
 * character that needs AltGr or ⌥, sits on a dead key or is missing in one of the layouts (`"@"`,
 * `"["`, `"^"`, `"ä"`): the chip then describes its entry.
 */
export function ariaKeyShortcutsFromLabel(label: string): string | undefined {
  const chip = parseChipLabel(label);
  if (!chip) return undefined;
  const { modifiers, key } = chip;
  const zoomIn = zoomInKeyShortcuts(modifiers, key);
  if (zoomIn) return zoomIn;
  const layoutKeys = lookUp(SHIFTED_CHARACTER_KEYS, key);
  if (layoutKeys) {
    const perLayout = layoutKeys.map(({ key: layoutKey, shift }) =>
      combination(shift ? [...modifiers, "Shift"] : modifiers, layoutKey),
    );
    return [...new Set(perLayout)].join(" ");
  }
  const name = sameKeyName(key);
  return name ? combination(modifiers, name) : undefined;
}

/**
 * How guide §5.6 sees the key of a shortcut chip on the US and the German layout:
 * - `same`: both name it alike and reach it without ⇧ (a letter, a digit, a named key);
 * - `shifted`: a character that needs ⇧ in one of them, so `aria-keyshortcuts` names the keys of
 *   both;
 * - `ruledOut`: a character that needs AltGr or ⌥, sits on a dead key or is missing in one of them
 *   (`"@"`, `"["`, `"^"`, `"ä"`), which §5.6 rules out as a shortcut.
 */
export type ShortcutKeyKind = "same" | "shifted" | "ruledOut";

// One character a keyboard types. Key symbols such as "⏎" and "⌫" (category So) name keys, so a
// chip like "⌘⏎" is no ruled-out character, only one the label table does not know.
const TYPED_CHARACTER = /^[\p{L}\p{N}\p{P}\p{Sc}\p{Sk}\p{Sm}]$/u;

/**
 * The `ShortcutKeyKind` of a shortcut chip label, by the same reading as
 * `ariaKeyShortcutsFromLabel`: `"?"` and `"⌘+"` are `shifted`, `"L"` and `"⌘−"` `same`, `"@"` and
 * `"⌘ä"` `ruledOut`. `undefined` for a label that is not one key combination (`"G then D"`) or
 * whose key is neither a known key nor a character (`"⌘⏎"`).
 */
export function shortcutKeyKind(label: string): ShortcutKeyKind | undefined {
  const chip = parseChipLabel(label);
  if (!chip) return undefined;
  if (Object.hasOwn(SHIFTED_CHARACTER_KEYS, chip.key)) return "shifted";
  if (sameKeyName(chip.key)) return "same";
  return TYPED_CHARACTER.test(chip.key) ? "ruledOut" : undefined;
}
