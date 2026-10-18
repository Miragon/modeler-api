import type { Bounds, Insets, ViewportState, ZoomTarget } from "../core/index.js";
import type { InjectorLike } from "./types.js";

export interface ViewportOptions {
  /** Content bounds in diagram coordinates; `undefined` = nothing to fit (empty file). */
  contentBounds(): Bounds | undefined;
  /** Fit insets at the moment of a fit (`shell.fitInsets()`). */
  insets(): Insets;
  /** Default: `matchMedia("(prefers-reduced-motion: reduce)").matches`. */
  prefersReducedMotion?(): boolean;
}

/**
 * The view of one diagram (guide §5.8, §5.9): zoom steps through `zoomScroll.stepZoom`, fit with
 * insets and the 100 % cap, automatic refit on container resize until the user moves the view,
 * user-move detection by comparison with the last box the viewport set itself.
 */
export interface Viewport extends ZoomTarget {
  /** Explicit fit; animated (250ms) unless `animate: false` or reduced motion. View becomes automatic. */
  fit(options?: { animate?: boolean }): void;
  /**
   * Call after every successful import: fits (jump) the first time the content bounds are
   * non-empty, unless the view was restored or the user moved it. Otherwise a no-op.
   */
  afterImport(): void;
  /** Restores a viewbox after a re-import (external change): reference updated, user-move state kept. */
  restore(viewbox: Bounds): void;
  /** The current viewbox (x, y, width, height), `undefined` before the canvas has a size. */
  getViewbox(): Bounds | undefined;
  /** True until the user zoomed or panned; a resize then refits. */
  isAutomatic(): boolean;
  /** For VS Code `setState`; `undefined` before the first import. */
  getState(): ViewportState | undefined;
  /** Restores a persisted view (it wins over the first automatic fit). */
  setState(state: ViewportState): void;
  /** Disconnects observers, listeners and a running animation. */
  destroy(): void;
}

/** A viewport over `canvas` and `zoomScroll` of `diagram`, observing `canvas.getContainer()`. */
export function createViewport(diagram: InjectorLike, options: ViewportOptions): Viewport {
  throw new Error("@miragon/modeler-shell: createViewport is not implemented yet");
}
