import type { Bounds, ViewportState } from "../../core/index.js";

/** `acquireVsCodeApi()` as far as the state helpers need it. */
export interface WebviewStateApi {
  getState(): unknown;
  setState(state: unknown): void;
}

/** What the shell keeps across a webview rebuild (guide §13.5: legend state and view). */
export interface ShellWebviewState {
  legendOpen?: boolean | undefined;
  view?: ViewportState | undefined;
}

/** The key under which the shell's part lives in the webview state; other keys stay untouched. */
export const SHELL_STATE_KEY = "modelerShell";

type StateRecord = Record<string, unknown>;

function isRecord(value: unknown): value is StateRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function storedState(api: WebviewStateApi): StateRecord {
  const state = api.getState();
  return isRecord(state) ? state : {};
}

function viewboxFrom(value: unknown): Bounds | undefined {
  if (!isRecord(value)) return undefined;
  const { x, y, width, height } = value;
  if (typeof x !== "number" || typeof y !== "number") return undefined;
  if (typeof width !== "number" || typeof height !== "number") return undefined;
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return undefined;
  }
  return width > 0 && height > 0 ? { x, y, width, height } : undefined;
}

function viewFrom(value: unknown): ViewportState | undefined {
  if (!isRecord(value) || typeof value.userMoved !== "boolean") return undefined;
  const viewbox = viewboxFrom(value.viewbox);
  return viewbox ? { viewbox, userMoved: value.userMoved } : undefined;
}

/** The shell's part of `api.getState()`; `{}` when there is none or it is malformed. */
export function readShellState(api: WebviewStateApi): ShellWebviewState {
  const part = storedState(api)[SHELL_STATE_KEY];
  if (!isRecord(part)) return {};
  const state: ShellWebviewState = {};
  if (typeof part.legendOpen === "boolean") state.legendOpen = part.legendOpen;
  const view = viewFrom(part.view);
  if (view) state.view = view;
  return state;
}

/**
 * Merges `patch` into the shell's part and writes the whole state back, keeping every other key.
 * A value that is `undefined` (for example `viewport.getState()` before the first import) or
 * malformed leaves the stored value alone; nothing is written when nothing changed.
 */
export function writeShellState(api: WebviewStateApi, patch: ShellWebviewState): void {
  const state = storedState(api);
  const part = isRecord(state[SHELL_STATE_KEY]) ? (state[SHELL_STATE_KEY] as StateRecord) : {};
  const next: StateRecord = { ...part };
  if (typeof patch.legendOpen === "boolean") next.legendOpen = patch.legendOpen;
  const view = viewFrom(patch.view);
  if (view) next.view = view;
  if (JSON.stringify(next) === JSON.stringify(state[SHELL_STATE_KEY])) return;
  api.setState({ ...state, [SHELL_STATE_KEY]: next });
}

/** What `persistView` reads of a viewport (`connectDiagramJs(…).viewport`). */
export interface PersistableView {
  onChange(listener: () => void): () => void;
  getState(): ViewportState | undefined;
}

export interface PersistViewOptions {
  /** Quiet time before the write, default 250ms. */
  delayMs?: number | undefined;
}

/** A pan, a wheel zoom or a fit animation changes the view on every frame. */
const PERSIST_VIEW_DELAY_MS = 250;

/**
 * Keeps the stored view (`writeShellState(api, { view })`) up to date once the view has rested for
 * `delayMs`, instead of one `vscode.setState` IPC message per animation frame. Returns the stop
 * function; it writes a pending change at once.
 */
export function persistView(
  api: WebviewStateApi,
  viewport: PersistableView,
  options: PersistViewOptions = {},
): () => void {
  const delayMs = options.delayMs ?? PERSIST_VIEW_DELAY_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const write = (): void => {
    timer = undefined;
    writeShellState(api, { view: viewport.getState() });
  };
  const unsubscribe = viewport.onChange(() => {
    clearTimeout(timer);
    timer = setTimeout(write, delayMs);
  });
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    unsubscribe();
    if (timer === undefined) return;
    clearTimeout(timer);
    write();
  };
}
