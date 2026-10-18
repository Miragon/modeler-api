export type { AppearanceListenerOptions } from "./appearance.js";
export { applyAppearance, connectAppearance } from "./appearance.js";
export type { VsCodeShellOptions } from "./mount.js";
export { mountVsCodeShell } from "./mount.js";
export type { ShellWebviewState, WebviewStateApi } from "./state.js";
export { SHELL_STATE_KEY, readShellState, writeShellState } from "./state.js";
export type { AppearanceMessage } from "../protocol.js";
export { APPEARANCE_MESSAGE_TYPE, appearanceMessage, isAppearanceMessage } from "../protocol.js";
