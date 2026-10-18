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
  isComposing?: boolean;
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
  throw new Error("@miragon/modeler-shell: matchChromeKey is not implemented yet");
}

/** Cmd/Ctrl + Z, Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y, without Alt (by `key`, `code` as fallback). */
export function isUndoRedoKey(event: KeyLike): boolean {
  throw new Error("@miragon/modeler-shell: isUndoRedoKey is not implemented yet");
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
 *    or a dialog/popover is open.
 * 2. Zoom keys: executed and prevented unless composing, in a text field or with a modal dialog;
 *    in the IDE host always stopped, also when not executed (VS Code must never zoom the window).
 * 3. Shift+1: `fit` under the same conditions; otherwise untouched (it types "!").
 * 4. IDE host, text field, undo/redo key: stopped only (the field keeps its native undo).
 * 5. IDE host, `defaultPrevented`: stopped (the canvas handled it; VS Code must not run it again).
 * Everything else passes untouched. `stopPropagation` is only ever true in the IDE host.
 */
export function decideKey(event: KeyLike, context: KeyContext): KeyDecision {
  throw new Error("@miragon/modeler-shell: decideKey is not implemented yet");
}

/** The keyboard the user sits at; decides the shortcut labels (guide §5.8). */
export type Platform = "mac" | "other";

/** The `navigator` fields `detectPlatform` reads. */
export interface NavigatorLike {
  platform?: string;
  userAgentData?: { platform?: string };
}

/**
 * `mac` when `userAgentData.platform ?? platform` matches `/mac/i`, else `other`; `other` without a
 * navigator. Read it in the webview or page itself, never from the extension host (VS Code Remote).
 */
export function detectPlatform(navigator?: NavigatorLike): Platform {
  throw new Error("@miragon/modeler-shell: detectPlatform is not implemented yet");
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
  throw new Error("@miragon/modeler-shell: shortcutLabel is not implemented yet");
}

/**
 * The `aria-keyshortcuts` value (WAI-ARIA names): zoom in `Meta+= Meta+Plus`, zoom out `Meta+-`,
 * 100 % `Meta+0`, fit `Shift+1`; outside macOS `Control` instead of `Meta`.
 */
export function ariaKeyShortcuts(key: ChromeKey, platform: Platform): string {
  throw new Error("@miragon/modeler-shell: ariaKeyShortcuts is not implemented yet");
}
