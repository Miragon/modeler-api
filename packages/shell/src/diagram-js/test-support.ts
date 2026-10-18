import type { Bounds, Point, Size } from "../core/index.js";
import type { DiagramViewbox } from "./types.js";

type Listener = (event: never) => unknown;

/** diagram-js `EventBus` semantics the shell relies on: priorities, `off`, a return value stops. */
export class FakeEventBus {
  private readonly listeners = new Map<string, Array<{ priority: number; callback: Listener }>>();

  on(events: string | string[], priorityOrListener: number | Listener, maybeListener?: Listener): void {
    const priority = typeof priorityOrListener === "number" ? priorityOrListener : 1000;
    const callback = typeof priorityOrListener === "number" ? maybeListener : priorityOrListener;
    if (!callback) throw new Error("listener missing");
    for (const name of ([] as string[]).concat(events)) {
      const list = this.listeners.get(name) ?? [];
      const index = list.findIndex((entry) => entry.priority < priority);
      list.splice(index === -1 ? list.length : index, 0, { priority, callback });
      this.listeners.set(name, list);
    }
  }

  off(events: string | string[], listener?: Listener): void {
    for (const name of ([] as string[]).concat(events)) {
      const list = this.listeners.get(name) ?? [];
      this.listeners.set(name, listener ? list.filter((entry) => entry.callback !== listener) : []);
    }
  }

  fire(name: string, event: object = {}): unknown {
    for (const { callback } of [...(this.listeners.get(name) ?? [])]) {
      const result = (callback as (event: object) => unknown)(event);
      if (result !== undefined) return result;
    }
    return undefined;
  }

  count(name?: string): number {
    if (name) return this.listeners.get(name)?.length ?? 0;
    return [...this.listeners.values()].reduce((sum, list) => sum + list.length, 0);
  }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * diagram-js `Canvas` viewbox semantics: the setter scales by `min(outer / box)` and translates by
 * `-box.x · scale`; the getter rounds the matrix to three decimals and divides by the scale;
 * `canvas.viewbox.changing` fires synchronously, `canvas.viewbox.changed` synchronously or, with
 * `deferUpdate`, debounced until `flushDeferred()` (it then carries the view of that moment).
 */
export class FakeCanvas {
  size: Size = { width: 1000, height: 800 };
  deferUpdate = false;
  readonly container = document.createElement("div");
  readonly viewboxWrites: Bounds[] = [];
  readonly zoomCalls: Array<[number, Point?]> = [];
  resizedCalls = 0;
  private scaleValue = 1;
  private translateX = 0;
  private translateY = 0;
  private deferred: (() => void) | undefined;

  constructor(private readonly eventBus: FakeEventBus) {}

  getContainer(): HTMLElement {
    return this.container;
  }

  getSize(): Size {
    return { ...this.size };
  }

  viewbox(): DiagramViewbox;
  viewbox(box: Bounds): void;
  viewbox(box?: Bounds): DiagramViewbox | void {
    if (!box) {
      const scale = round(this.scaleValue);
      const x = round(-this.translateX);
      const y = round(-this.translateY);
      return {
        x: x ? x / scale : 0,
        y: y ? y / scale : 0,
        width: this.size.width / scale,
        height: this.size.height / scale,
        scale,
        inner: { x: 0, y: 0, width: 0, height: 0 },
        outer: this.getSize(),
      };
    }
    this.viewboxWrites.push({ x: box.x, y: box.y, width: box.width, height: box.height });
    this.change(() => {
      const scale = Math.min(this.size.width / box.width, this.size.height / box.height);
      this.scaleValue = scale;
      this.translateX = -box.x * scale;
      this.translateY = -box.y * scale;
    });
  }

  zoom(): number;
  zoom(scale: number, center?: Point): number;
  zoom(scale?: number, center?: Point): number {
    if (scale === undefined) return this.viewbox().scale;
    this.zoomCalls.push(center === undefined ? [scale] : [scale, center]);
    this.change(() => {
      const point = center ?? { x: this.size.width / 2, y: this.size.height / 2 };
      const diagramX = (point.x - this.translateX) / this.scaleValue;
      const diagramY = (point.y - this.translateY) / this.scaleValue;
      this.scaleValue = scale;
      this.translateX = point.x - diagramX * scale;
      this.translateY = point.y - diagramY * scale;
    });
    return round(scale);
  }

  /** A pan as the user drags the canvas (movecanvas: `canvas.scroll`). */
  pan(dx: number, dy: number): void {
    this.change(() => {
      this.translateX += dx;
      this.translateY += dy;
    });
  }

  resized(): void {
    this.resizedCalls++;
    this.eventBus.fire("canvas.resized");
  }

  flushDeferred(): void {
    const fire = this.deferred;
    this.deferred = undefined;
    fire?.();
  }

  private change(apply: () => void): void {
    this.eventBus.fire("canvas.viewbox.changing");
    apply();
    const fire = () => this.eventBus.fire("canvas.viewbox.changed", { viewbox: this.viewbox() });
    if (this.deferUpdate) this.deferred = fire;
    else fire();
  }
}

/** `requestAnimationFrame` and `cancelAnimationFrame` under test control (`request`, `cancel`). */
export class FrameQueue {
  private callbacks = new Map<number, FrameRequestCallback>();
  private nextId = 1;
  cancelled = 0;

  readonly request = (callback: FrameRequestCallback): number => {
    const id = this.nextId++;
    this.callbacks.set(id, callback);
    return id;
  };

  readonly cancel = (id: number): void => {
    if (this.callbacks.delete(id)) this.cancelled++;
  };

  get pending(): number {
    return this.callbacks.size;
  }

  run(timestamp: number): void {
    const due = [...this.callbacks.values()];
    this.callbacks.clear();
    for (const callback of due) callback(timestamp);
  }
}

/** `ResizeObserver` under test control. */
export class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly observed: Element[] = [];
  disconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  observe(element: Element): void {
    this.observed.push(element);
  }

  unobserve(): void {}

  disconnect(): void {
    this.disconnected = true;
  }

  notify(): void {
    if (!this.disconnected) this.callback([], this as unknown as ResizeObserver);
  }
}
