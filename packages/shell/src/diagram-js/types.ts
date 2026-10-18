import type { Bounds, Point, ScaledViewbox, Size } from "../core/index.js";

/**
 * diagram-js services, typed structurally: the shell never imports diagram-js (not even its
 * types), so it works with every diagram-js 15.28+ build the modeler bundles.
 */

/** Anything with diagram-js's `get`: a `Diagram`, a renderer's `Modeler`, a didi injector. */
export interface InjectorLike {
  get<T>(name: string): T;
}

/** A didi module declaration, assignable to didi's `ModuleDeclaration`. */
export interface ModuleDeclarationLike {
  __init__?: string[];
  __depends__?: ModuleDeclarationLike[];
  [name: string]: unknown;
}

export type DiagramEventListener = (event: never) => unknown;

/** `eventBus` */
export interface EventBusLike {
  on(events: string | string[], priority: number, listener: DiagramEventListener): void;
  on(events: string | string[], listener: DiagramEventListener): void;
  off(events: string | string[], listener?: DiagramEventListener): void;
}

/** `canvas.viewbox()` */
export interface DiagramViewbox extends ScaledViewbox {
  inner: Bounds;
  outer: Size;
}

/** `canvas` */
export interface CanvasLike {
  getContainer(): HTMLElement;
  getSize(): Size;
  viewbox(): DiagramViewbox;
  viewbox(box: Bounds): void;
  zoom(): number;
  zoom(scale: number, center?: Point): number;
  resized(): void;
}

/** `zoomScroll` */
export interface ZoomScrollLike {
  stepZoom(delta: number, position?: Point): void;
}

/** `keyboard` (listeners are removed through `eventBus.off("keyboard.keydown", …)`) */
export interface KeyboardLike {
  addListener(priority: number, listener: (context: { keyEvent: KeyboardEvent }) => unknown): void;
}

/** `palette` */
export interface PaletteLike {
  getEntries(): Record<string, { title?: string; shortcut?: string; group?: string }>;
}
