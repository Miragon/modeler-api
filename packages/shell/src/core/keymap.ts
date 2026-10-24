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

/** A text field: every input, select list and editable text (label editor, inspector, dialogs). */
export const TEXT_FIELD_SELECTOR =
  "input, textarea, select, [contenteditable]:not([contenteditable='false'])";

/** Where a key was pressed, as the shell's one `keydown` listener sees it. */
export interface KeyContext {
  host: ShellHost;
  /** The event target matches `TEXT_FIELD_SELECTOR` or is `isContentEditable`. */
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
  plus: "Plus",
};

function ariaKeyName(key: string): string | undefined {
  const named = NAMED_KEYS[key.toLowerCase()];
  if (named) return named;
  if (/^f\d{1,2}$/i.test(key)) return key.toUpperCase();
  if (key.length !== 1 || MAC_MODIFIER_SYMBOLS[key]) return undefined;
  if (key === "+") return "Plus";
  if (key === " ") return "Space";
  return key.toUpperCase();
}

/**
 * The `aria-keyshortcuts` value (WAI-ARIA names, guide §5.6) for a shortcut chip label: `"L"` →
 * `"L"`, `"⇧L"` → `"Shift+L"`, `"⌘⇧Z"` → `"Meta+Shift+Z"`, `"Ctrl+Shift+E"` → `"Control+Shift+E"`,
 * `"Del"` → `"Delete"`, `"Ctrl++"` → `"Control+Plus"`. `undefined` for a label that is not one key
 * combination (`"G then D"`, `"1–9"`, empty).
 */
export function ariaKeyShortcutsFromLabel(label: string): string | undefined {
  let rest = label.trim();
  const modifiers: string[] = [];
  for (let symbol = MAC_MODIFIER_SYMBOLS[rest.charAt(0)]; symbol && rest.length > 1;) {
    modifiers.push(symbol);
    rest = rest.slice(1).trim();
    symbol = MAC_MODIFIER_SYMBOLS[rest.charAt(0)];
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
    const modifier = MODIFIER_NAMES[part.toLowerCase()];
    if (!modifier) return undefined;
    modifiers.push(modifier);
  }
  const name = ariaKeyName(key);
  return name ? [...new Set(modifiers), name].join("+") : undefined;
}
