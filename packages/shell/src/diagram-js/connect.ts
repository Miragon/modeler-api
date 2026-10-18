import type { Bounds } from "../core/index.js";
import type { ShellHandle } from "../dom/index.js";
import type { InjectorLike } from "./types.js";
import type { Viewport } from "./viewport.js";

export interface ConnectOptions {
  /** Content bounds in diagram coordinates; `undefined` = nothing to fit (empty file). */
  contentBounds(): Bounds | undefined;
  prefersReducedMotion?(): boolean;
}

export interface DiagramJsConnection {
  readonly viewport: Viewport;
  /** Unbinds viewport, palette and keys from the shell; destroys neither the diagram nor the shell. */
  destroy(): void;
}

/**
 * Connects a diagram built with `shellModule` to a mounted shell: creates the viewport with
 * `shell.fitInsets`, binds it with `shell.setZoomTarget`, registers the palette
 * (`shell.registerPalette`) and calls `canvas.resized()`. Throws when `shellModule` is missing.
 */
export function connectDiagramJs(
  shell: ShellHandle,
  diagram: InjectorLike,
  options: ConnectOptions,
): DiagramJsConnection {
  throw new Error("@miragon/modeler-shell: connectDiagramJs is not implemented yet");
}
