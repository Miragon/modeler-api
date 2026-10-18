import type { ViewportState } from "../../core/index.js";

/** `acquireVsCodeApi()` as far as the state helpers need it. */
export interface WebviewStateApi {
  getState(): unknown;
  setState(state: unknown): void;
}

/** What the shell keeps across a webview rebuild (guide §13.5: legend state and view). */
export interface ShellWebviewState {
  legendOpen?: boolean;
  view?: ViewportState;
}

/** The key under which the shell's part lives in the webview state; other keys stay untouched. */
export const SHELL_STATE_KEY = "modelerShell";

/** The shell's part of `api.getState()`; `{}` when there is none or it is malformed. */
export function readShellState(api: WebviewStateApi): ShellWebviewState {
  throw new Error("@miragon/modeler-shell: readShellState is not implemented yet");
}

/** Merges `patch` into the shell's part and writes the whole state back, keeping every other key. */
export function writeShellState(api: WebviewStateApi, patch: ShellWebviewState): void {
  throw new Error("@miragon/modeler-shell: writeShellState is not implemented yet");
}
