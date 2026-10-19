import {
  FIT_ANIMATION_MS,
  REDUCED_MOTION_CLASS,
  VIEW_TOLERANCE,
  ZOOM_MAX,
  ZOOM_MIN,
  canZoomIn,
  canZoomOut,
  easeStandard,
  fitViewbox,
  freeRectCenter,
  interpolateViewbox,
  matchChromeKey,
  sameView,
  type Bounds,
  type Insets,
  type Point,
  type ScaledViewbox,
  type Size,
  type ViewportState,
  type ZoomTarget,
} from "../core/index.js";
import type {
  CanvasLike,
  DiagramEventListener,
  DiagramViewbox,
  EventBusLike,
  InjectorLike,
  ZoomScrollLike,
} from "./types.js";

export interface ViewportOptions {
  /**
   * Content bounds in diagram coordinates, tight around the content: the fit insets are the only
   * margin (guide §5.9). `undefined` = nothing to fit (empty file).
   */
  contentBounds(): Bounds | undefined;
  /** Fit insets at the moment of a fit (`shell.fitInsets()`). */
  insets(): Insets;
  /**
   * Default: `matchMedia("(prefers-reduced-motion: reduce)").matches`, or `<html>` carries
   * `REDUCED_MOTION_CLASS` (VS Code's `workbench.reduceMotion`, mirrored by `mountVsCodeShell`).
   */
  prefersReducedMotion?: (() => boolean) | undefined;
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
   * non-empty, unless a persisted view was set (`setState`) or the user moved it. When the first
   * import is empty, under the same conditions, it shows 100 % around the centre of the free
   * rectangle instead, whatever zoom the renderer's import left (an empty file opens at 100 %);
   * that view is the viewport's own, not a user move, so the first content still fits. Otherwise
   * a no-op. A `restore` keeps the view of an empty file, so its first content still fits; content
   * the user created on the canvas does not (guide §5.9), so the next import keeps the view.
   */
  afterImport(): void;
  /**
   * The web app opens another document (New diagram, Open…, Import…, Show example, a shared link,
   * a dropped file): the next `afterImport()` counts as the first again (guide §5.9). Forgets the
   * user's moves, a stored view and a pending restore, and stops a running fit animation, so
   * non-empty content fits (jump) and an empty document shows 100 %. Call it before the import.
   */
  newDocument(): void;
  /** Restores a viewbox after a re-import (external change): reference updated, user-move state kept. */
  restore(viewbox: Bounds): void;
  /** The current viewbox (x, y, width, height), `undefined` before the canvas has a size. */
  getViewbox(): Bounds | undefined;
  /**
   * The centre of the free rectangle (the container minus `insets()`, guide §5.9) in diagram
   * coordinates, where keyboard creation from the palette places an element (guide §5.5).
   * `undefined` while the container is 0 × 0 and after `destroy`.
   */
  freeRectCenter(): Point | undefined;
  /** True until the user zoomed or panned; a resize then refits. */
  isAutomatic(): boolean;
  /** For VS Code `setState`; `undefined` before the first import. */
  getState(): ViewportState | undefined;
  /** Restores a persisted view (it wins over the first automatic fit). */
  setState(state: ViewportState): void;
  /** Disconnects observers, listeners and a running animation; also runs on `diagram.destroy`. */
  destroy(): void;
}

/** A viewport over `canvas` and `zoomScroll` of `diagram`, observing `canvas.getContainer()`. */
export function createViewport(diagram: InjectorLike, options: ViewportOptions): Viewport {
  return new DiagramViewport(diagram, options);
}

type View = Pick<ScaledViewbox, "x" | "y" | "scale">;

/**
 * Renderers replace the content between these events and may set the viewbox while doing so
 * (Event Storming frames its board); those changes are not the user's.
 */
const IMPORT_START_EVENTS = ["import.parse.start", "import.render.start"];
const IMPORT_DONE_EVENT = "import.done";

/** Events after which the content bounds may differ (importers add shapes without `elements.changed`). */
const CONTENT_EVENTS = [
  "shape.added",
  "shape.removed",
  "connection.added",
  "connection.removed",
  "diagram.clear",
];

/** diagram-js `ZoomScroll`: `NUM_STEPS = 10` over `RANGE`, in log space. */
const ZOOM_STEP = Math.log10(ZOOM_MAX / ZOOM_MIN) / 10;

const CAPTURE = { capture: true } as const;

export class DiagramViewport implements Viewport {
  private readonly canvas: CanvasLike;
  private readonly eventBus: EventBusLike;
  private readonly container: HTMLElement;
  private readonly listeners = new Set<() => void>();
  private readonly subscriptions: Array<readonly [string | string[], DiagramEventListener]> = [];
  private readonly observer: ResizeObserver | undefined;
  private zoomScrollService: ZoomScrollLike | null | undefined;

  /** The last view the viewport set as its own (fit target, restore); user moves differ from it. */
  private reference: View | undefined;
  /** The last view written, animation frames included. */
  private lastWritten: View | undefined;
  /** The container size the current view was set or last resized for. */
  private lastSize: Size | undefined;
  private writing = 0;
  private userMoved = false;
  private importing = false;
  private imported = false;
  private firstFitPending = true;
  /** Nothing has decided the view yet, so an empty first import shows 100 %. */
  private emptyViewPending = true;
  /** The 100 % of an empty first import waits for the container to get a size (hidden tab). */
  private emptyViewDue = false;
  /** `canFit()` of the current content; the zoom panel asks every frame, `contentBounds` may be costly. */
  private fittable: boolean | undefined;
  private lastZoom = 1;
  /** An automatic fit is due but the container had no size yet (hidden tab). */
  private autoFitDue = false;
  /** A restored view waits for the container to get a size. */
  private pendingView: Bounds | undefined;
  private animation: { frame: number } | undefined;
  private resizeFrame: number | undefined;
  private destroyed = false;

  constructor(
    private readonly diagram: InjectorLike,
    private readonly options: ViewportOptions,
  ) {
    this.canvas = diagram.get<CanvasLike>("canvas");
    this.eventBus = diagram.get<EventBusLike>("eventBus");
    this.container = this.canvas.getContainer();

    this.subscribe("canvas.viewbox.changing", this.notify);
    this.subscribe("canvas.viewbox.changed", this.onViewboxChanged);
    this.subscribe(IMPORT_START_EVENTS, this.onImportStart);
    this.subscribe(IMPORT_DONE_EVENT, this.onImportDone);
    this.subscribe("elements.changed", this.onElementsChanged);
    this.subscribe(CONTENT_EVENTS, this.onContentChanged);
    this.subscribe("diagram.destroy", () => this.destroy());

    this.container.addEventListener("wheel", this.onPointerInput, { capture: true, passive: true });
    this.container.addEventListener("pointerdown", this.onPointerInput, CAPTURE);
    this.container.addEventListener("keydown", this.onKeyInput, CAPTURE);

    if (typeof ResizeObserver === "function") {
      this.observer = new ResizeObserver(this.onResizeObserved);
      this.observer.observe(this.container);
    }
  }

  zoom(): number {
    if (!this.destroyed) this.lastZoom = this.canvas.zoom();
    return this.lastZoom;
  }

  stepZoom(direction: 1 | -1): void {
    if (this.destroyed) return;
    this.beforeUserChange();
    // Below 20 % ZoomScroll caps a step out to 20 %, which zooms in (guide §5.8).
    const zoom = this.canvas.zoom();
    if (direction < 0 ? !canZoomOut(zoom) : !canZoomIn(zoom)) return;
    const zoomScroll = this.zoomScroll();
    if (zoomScroll) zoomScroll.stepZoom(direction);
    else this.canvas.zoom(stepOnRaster(zoom, direction));
  }

  zoomToActual(): void {
    if (this.destroyed) return;
    this.beforeUserChange();
    this.canvas.zoom(1);
  }

  fit(options?: { animate?: boolean }): void {
    if (this.destroyed) return;
    this.importing = false;
    this.fitTo(options?.animate !== false && !this.prefersReducedMotion());
  }

  canFit(): boolean {
    if (this.destroyed) return false;
    this.fittable ??= hasExtent(this.options.contentBounds());
    return this.fittable;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  afterImport(): void {
    if (this.destroyed) return;
    this.importing = false;
    this.imported = true;
    this.fittable = undefined;
    if (this.firstFitPending && this.canFit()) {
      this.firstFitPending = false;
      this.emptyViewPending = false;
      this.emptyViewDue = false;
      if (!this.userMoved && !this.fitTo(false)) this.autoFitDue = true;
    } else if (this.firstFitPending && this.emptyViewPending) {
      this.emptyViewPending = false;
      if (!this.userMoved && !this.showActualSize()) this.emptyViewDue = true;
    }
    this.notify();
  }

  newDocument(): void {
    if (this.destroyed) return;
    this.cancelAnimation();
    this.userMoved = false;
    this.firstFitPending = true;
    this.emptyViewPending = true;
    this.emptyViewDue = false;
    this.autoFitDue = false;
    this.pendingView = undefined;
    this.fittable = undefined;
  }

  restore(viewbox: Bounds): void {
    if (this.destroyed) return;
    this.importing = false;
    this.imported = true;
    this.fittable = undefined;
    this.emptyViewPending = false;
    this.emptyViewDue = false;
    this.cancelAnimation();
    this.show(viewbox);
    this.notify();
  }

  freeRectCenter(): Point | undefined {
    if (this.destroyed) return undefined;
    const centre = freeRectCenter(this.canvas.getSize(), this.options.insets());
    const view = this.currentView();
    if (!centre || !view) return undefined;
    return { x: view.x + centre.x / view.scale, y: view.y + centre.y / view.scale };
  }

  getViewbox(): Bounds | undefined {
    if (this.destroyed) return undefined;
    if (this.pendingView) return { ...this.pendingView };
    const size = this.canvas.getSize();
    if (!hasSize(size)) return undefined;
    const { x, y, scale } = this.canvas.viewbox();
    // The getter caches `outer` until the next change; the size is read fresh.
    return { x, y, width: size.width / scale, height: size.height / scale };
  }

  isAutomatic(): boolean {
    return !this.userMoved;
  }

  getState(): ViewportState | undefined {
    if (!this.imported) return undefined;
    const viewbox = this.getViewbox();
    return viewbox ? { viewbox, userMoved: this.userMoved } : undefined;
  }

  setState(state: ViewportState): void {
    if (this.destroyed) return;
    this.importing = false;
    this.imported = true;
    this.fittable = undefined;
    this.cancelAnimation();
    this.userMoved = state.userMoved;
    this.autoFitDue = false;
    this.emptyViewPending = false;
    this.emptyViewDue = false;
    if (this.canFit()) this.firstFitPending = false;
    this.show(state.viewbox);
    this.notify();
  }

  /** `canvas.resized()`; viewbox changes it causes (keep-selection-visible) are not user moves. */
  resized(): void {
    if (this.destroyed) return;
    this.writing++;
    try {
      this.canvas.resized();
    } finally {
      this.writing--;
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelAnimation();
    if (this.resizeFrame !== undefined) cancelAnimationFrame(this.resizeFrame);
    this.resizeFrame = undefined;
    this.observer?.disconnect();
    this.container.removeEventListener("wheel", this.onPointerInput, CAPTURE);
    this.container.removeEventListener("pointerdown", this.onPointerInput, CAPTURE);
    this.container.removeEventListener("keydown", this.onKeyInput, CAPTURE);
    for (const [events, listener] of this.subscriptions.splice(0)) this.eventBus.off(events, listener);
    this.listeners.clear();
  }

  /** Fits now (jump) or animated; false when there is nothing to fit or no container size. */
  private fitTo(animate: boolean): boolean {
    this.cancelAnimation();
    const bounds = this.options.contentBounds();
    if (!bounds) return false;
    const target = fitViewbox(bounds, this.canvas.getSize(), this.options.insets());
    if (!target) return false;
    this.userMoved = false;
    this.firstFitPending = false;
    this.autoFitDue = false;
    this.emptyViewPending = false;
    this.emptyViewDue = false;
    this.pendingView = undefined;
    const from = this.currentView();
    if (animate && from && !sameView(from, target) && typeof requestAnimationFrame === "function") {
      this.animate(from, target);
    } else {
      this.write(target);
    }
    return true;
  }

  private animate(from: ScaledViewbox, target: ScaledViewbox): void {
    this.reference = toView(target);
    const animation = { frame: 0 };
    const startedAt = performance.now();
    const step = (timestamp: number): void => {
      if (this.animation !== animation) return;
      if (!hasSize(this.canvas.getSize())) {
        // Hidden mid-animation: fit again once the container is back.
        this.cancelAnimation();
        this.autoFitDue = true;
        return;
      }
      const progress = Math.min(1, Math.max(0, (timestamp - startedAt) / FIT_ANIMATION_MS));
      if (progress >= 1) {
        this.animation = undefined;
        this.write(target);
        return;
      }
      this.write(interpolateViewbox(from, target, easeStandard(progress)), false);
      animation.frame = requestAnimationFrame(step);
    };
    this.animation = animation;
    animation.frame = requestAnimationFrame(step);
  }

  private cancelAnimation(): void {
    const animation = this.animation;
    if (!animation) return;
    this.animation = undefined;
    cancelAnimationFrame(animation.frame);
    if (this.lastWritten) this.reference = this.lastWritten;
  }

  /**
   * 100 % around the centre of the free rectangle, written as the viewport's own view; true when
   * the view is at 100 % afterwards, false while the container has no size.
   */
  private showActualSize(): boolean {
    const size = this.canvas.getSize();
    const centre = freeRectCenter(size, this.options.insets());
    const view = this.currentView();
    if (!centre || !view) return false;
    if (Math.abs(view.scale - 1) <= VIEW_TOLERANCE) return true;
    this.cancelAnimation();
    this.write({
      x: view.x + centre.x / view.scale - centre.x,
      y: view.y + centre.y / view.scale - centre.y,
      width: size.width,
      height: size.height,
    });
    return true;
  }

  /** Shows a restored view now, or once the container has a size. */
  private show(viewbox: Bounds): void {
    if (hasSize(this.canvas.getSize())) {
      this.pendingView = undefined;
      this.write(viewbox);
    } else {
      this.pendingView = { x: viewbox.x, y: viewbox.y, width: viewbox.width, height: viewbox.height };
    }
  }

  /** Callers make sure the container has a size: diagram-js would set a scale of 0 otherwise. */
  private write(box: Bounds, asReference = true): void {
    const size = this.canvas.getSize();
    // The scale diagram-js's setter derives from the box (`Canvas#viewbox`).
    const view: View = {
      x: box.x,
      y: box.y,
      scale: Math.min(size.width / box.width, size.height / box.height),
    };
    this.writing++;
    try {
      this.canvas.viewbox({ x: box.x, y: box.y, width: box.width, height: box.height });
    } finally {
      this.writing--;
    }
    this.lastWritten = view;
    if (asReference) this.reference = view;
    this.lastSize = { width: size.width, height: size.height };
  }

  private currentView(): ScaledViewbox | undefined {
    const size = this.canvas.getSize();
    const { x, y, scale } = this.canvas.viewbox();
    if (!(scale > 0 && Number.isFinite(scale))) return undefined;
    return { x, y, width: size.width / scale, height: size.height / scale, scale };
  }

  private beforeUserChange(): void {
    this.importing = false;
    this.cancelAnimation();
  }

  private zoomScroll(): ZoomScrollLike | null {
    if (this.zoomScrollService === undefined) {
      try {
        this.zoomScrollService = this.diagram.get<ZoomScrollLike | null>("zoomScroll") ?? null;
      } catch {
        this.zoomScrollService = null;
      }
    }
    return this.zoomScrollService;
  }

  private prefersReducedMotion(): boolean {
    if (this.options.prefersReducedMotion) return this.options.prefersReducedMotion();
    if (this.container.ownerDocument.documentElement.classList.contains(REDUCED_MOTION_CLASS)) return true;
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  private isOwnView(current: View): boolean {
    if (this.reference && sameView(current, this.reference)) return true;
    return (
      this.animation !== undefined && this.lastWritten !== undefined && sameView(current, this.lastWritten)
    );
  }

  // Not a flag around the own writes alone: with `canvas.deferUpdate` the event of an own change
  // arrives up to 300ms later, so it is recognised by its view.
  private readonly onViewboxChanged = (event?: { viewbox?: DiagramViewbox }): void => {
    if (this.writing === 0 && !this.importing) {
      const current = event?.viewbox ?? this.canvas.viewbox();
      if (!this.isOwnView(current)) {
        this.cancelAnimation();
        this.userMoved = true;
        this.autoFitDue = false;
        this.emptyViewDue = false;
      }
    }
    this.notify();
  };

  private readonly onImportStart = (): void => {
    this.importing = true;
  };

  private readonly onImportDone = (): void => {
    this.importing = false;
    this.fittable = undefined;
    this.notify();
  };

  private readonly onContentChanged = (): void => {
    this.fittable = undefined;
  };

  // Guide §5.9: an element the user creates on the canvas never fits. Once such content exists,
  // only imports that keep the view follow, so the first automatic fit is no longer due.
  private readonly onElementsChanged = (): void => {
    this.fittable = undefined;
    if (this.imported && !this.importing && this.firstFitPending && this.canFit()) {
      this.firstFitPending = false;
    }
    this.notify();
  };

  // User input also ends an import window a failed import never closed with `import.done`.
  private readonly onPointerInput = (): void => {
    this.importing = false;
    this.cancelAnimation();
  };

  private readonly onKeyInput = (event: KeyboardEvent): void => {
    this.importing = false;
    if (matchChromeKey(event)) this.cancelAnimation();
  };

  private readonly onResizeObserved = (): void => {
    if (this.destroyed || this.resizeFrame !== undefined) return;
    if (typeof requestAnimationFrame !== "function") {
      this.onResize();
      return;
    }
    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = undefined;
      this.onResize();
    });
  };

  private onResize(): void {
    if (this.destroyed) return;
    const size = this.canvas.getSize();
    if (!hasSize(size)) return;
    const changed = this.lastSize?.width !== size.width || this.lastSize.height !== size.height;
    if (!changed && !this.pendingView && !this.autoFitDue && !this.emptyViewDue) return;
    this.lastSize = { width: size.width, height: size.height };
    this.resized();
    const restored = this.pendingView;
    if (restored) {
      this.pendingView = undefined;
      this.write(restored);
    }
    if (this.userMoved) return;
    if (this.emptyViewDue) {
      this.emptyViewDue = false;
      this.showActualSize();
      return;
    }
    // A view restored for this very moment is not refitted; a fit that was due still runs.
    if (this.autoFitDue || (!restored && !this.firstFitPending)) this.fitTo(false);
  }

  private subscribe(events: string | string[], listener: (event: never) => unknown): void {
    this.eventBus.on(events, listener);
    this.subscriptions.push([events, listener]);
  }

  private readonly notify = (): void => {
    for (const listener of [...this.listeners]) listener();
  };
}

function toView(box: ScaledViewbox): View {
  return { x: box.x, y: box.y, scale: box.scale };
}

function hasSize(size: Size): boolean {
  return size.width > 0 && size.height > 0;
}

function hasExtent(bounds: Bounds | undefined): boolean {
  return bounds !== undefined && (bounds.width > 0 || bounds.height > 0);
}

/** `ZoomScroll#_zoom` for a diagram without `zoomScroll`: snap to the raster, one step, cap. */
function stepOnRaster(zoom: number, direction: 1 | -1): number {
  const level = Math.round(Math.log10(zoom) / ZOOM_STEP) * ZOOM_STEP + ZOOM_STEP * direction;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, 10 ** level));
}
