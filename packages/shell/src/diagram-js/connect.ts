import type { Bounds } from "../core/index.js";
import type { ShellHandle } from "../dom/index.js";
import { shellServiceOf } from "./service.js";
import type { InjectorLike } from "./types.js";
import { DiagramViewport, type Viewport } from "./viewport.js";

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
  const service = shellServiceOf(diagram);
  const prefersReducedMotion = options.prefersReducedMotion?.bind(options);
  const viewport = new DiagramViewport(diagram, {
    contentBounds: () => options.contentBounds(),
    insets: () => shell.fitInsets(),
    ...(prefersReducedMotion ? { prefersReducedMotion } : {}),
  });
  shell.setZoomTarget(viewport);
  const detachPalette = service.attachShell(shell);
  // The shell has moved the canvas element into its slot; diagram-js caches the old size.
  viewport.resized();

  let destroyed = false;
  return {
    viewport,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      detachPalette();
      shell.setZoomTarget(null);
      viewport.destroy();
    },
  };
}
