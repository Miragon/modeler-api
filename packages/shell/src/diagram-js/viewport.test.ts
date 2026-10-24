import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { FIT_ANIMATION_MS, fitViewbox, sameView, type Bounds, type Insets } from "../core/index.js";
import {
  FakeCanvas,
  FakeEventBus,
  FakeResizeObserver,
  FrameQueue,
} from "../../test/support/diagram-js.js";
import {
  createViewport,
  type DiagramViewport,
  type Viewport,
  type ViewportOptions,
} from "./viewport.js";

const INSETS: Insets = { top: 88, right: 24, bottom: 64, left: 24 };
const CONTENT: Bounds = { x: 100, y: 100, width: 1900, height: 900 };
const START = 1000;

interface Setup {
  bus: FakeEventBus;
  canvas: FakeCanvas;
  stepZoom: ReturnType<typeof vi.fn>;
  viewport: Viewport;
  observer: FakeResizeObserver;
  setContent(bounds: Bounds | undefined): void;
}

let frames: FrameQueue;

beforeEach(() => {
  frames = new FrameQueue();
  vi.stubGlobal("requestAnimationFrame", frames.request);
  vi.stubGlobal("cancelAnimationFrame", frames.cancel);
  FakeResizeObserver.instances = [];
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  vi.spyOn(performance, "now").mockReturnValue(START);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function setup(
  options: Partial<ViewportOptions> & {
    content?: Bounds | undefined;
    zoomScroll?: boolean;
    deferUpdate?: boolean;
  } = {},
): Setup {
  const bus = new FakeEventBus();
  const canvas = new FakeCanvas(bus);
  canvas.deferUpdate = options.deferUpdate ?? false;
  // diagram-js ZoomScroll#_zoom: snap to the raster, one step, cap to 20 % … 400 %.
  const stepZoom = vi.fn((delta: number) => {
    const step = Math.log10(20) / 10;
    const level = Math.round(Math.log10(canvas.zoom()) / step) * step + step * (delta > 0 ? 1 : -1);
    canvas.zoom(Math.min(4, Math.max(0.2, 10 ** level)));
  });
  const services: Record<string, unknown> = { canvas, eventBus: bus };
  if (options.zoomScroll !== false) services.zoomScroll = { stepZoom };
  const diagram = {
    get<T>(name: string): T {
      if (!(name in services)) throw new Error(`No provider for "${name}"!`);
      return services[name] as T;
    },
  };
  let content: Bounds | undefined = "content" in options ? options.content : CONTENT;
  const viewport = createViewport(diagram, {
    contentBounds: options.contentBounds ?? (() => content),
    insets: options.insets ?? (() => INSETS),
    prefersReducedMotion: options.prefersReducedMotion ?? (() => false),
  });
  const observer = FakeResizeObserver.instances.at(-1);
  if (!observer) throw new Error("no ResizeObserver");
  return {
    bus,
    canvas,
    stepZoom,
    viewport,
    observer,
    setContent(bounds) {
      content = bounds;
    },
  };
}

function expectedFit(
  canvas: FakeCanvas,
  bounds: Bounds = CONTENT,
  insets: Insets = INSETS,
): Bounds {
  const box = fitViewbox(bounds, canvas.getSize(), insets);
  if (!box) throw new Error("nothing to fit");
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

function lastWrite(canvas: FakeCanvas): Bounds | undefined {
  return canvas.viewboxWrites.at(-1);
}

function resize({ canvas, observer }: Setup, width: number, height: number): void {
  canvas.size = { width, height };
  observer.notify();
  frames.run(START);
}

describe("zoom", () => {
  it("steps through zoomScroll.stepZoom without a position", () => {
    const { viewport, stepZoom } = setup();
    viewport.stepZoom(1);
    viewport.stepZoom(-1);
    expect(stepZoom.mock.calls).toEqual([[1], [-1]]);
  });

  it("zooms to 100 % with canvas.zoom(1) around the container centre", () => {
    const { viewport, canvas } = setup();
    canvas.zoom(0.5);
    viewport.zoomToActual();
    expect(canvas.zoomCalls.at(-1)).toEqual([1]);
    expect(viewport.zoom()).toBe(1);
  });

  it("falls back to the zoomScroll raster without a zoomScroll service", () => {
    const { viewport, canvas } = setup({ zoomScroll: false });
    viewport.stepZoom(1);
    expect(viewport.zoom()).toBeCloseTo(1.349, 3);
    viewport.stepZoom(-1);
    viewport.stepZoom(-1);
    expect(canvas.zoom()).toBeCloseTo(0.741, 3);
  });

  it("never zooms in on zoom out below 20 %, nor beyond 400 %", () => {
    const { viewport, canvas, stepZoom } = setup();
    canvas.zoom(0.12);
    viewport.stepZoom(-1);
    canvas.zoom(0.2);
    viewport.stepZoom(-1);
    expect(stepZoom).not.toHaveBeenCalled();
    expect(canvas.zoom()).toBe(0.2);
    viewport.stepZoom(1);
    expect(stepZoom).toHaveBeenCalledWith(1);
    canvas.zoom(4);
    stepZoom.mockClear();
    viewport.stepZoom(1);
    expect(stepZoom).not.toHaveBeenCalled();
    viewport.stepZoom(-1);
    expect(canvas.zoom()).toBeCloseTo(3.314, 3);
  });

  it("counts zoom steps and 100 % as user moves", () => {
    const { viewport } = setup();
    viewport.fit({ animate: false });
    viewport.stepZoom(1);
    expect(viewport.isAutomatic()).toBe(false);
    viewport.fit({ animate: false });
    viewport.zoomToActual();
    expect(viewport.isAutomatic()).toBe(false);
  });
});

describe("fit", () => {
  it("sets fitViewbox(contentBounds, canvas.getSize(), insets) through canvas.viewbox", () => {
    const insets: Insets = { top: 140, right: 324, bottom: 64, left: 24 };
    const { viewport, canvas } = setup({ insets: () => insets });
    viewport.fit({ animate: false });
    expect(lastWrite(canvas)).toEqual(expectedFit(canvas, CONTENT, insets));
    expect(viewport.isAutomatic()).toBe(true);
    expect(canvas.zoomCalls).toEqual([]);
  });

  it("never zooms above 100 %", () => {
    const { viewport } = setup({ content: { x: 0, y: 0, width: 50, height: 40 } });
    viewport.fit({ animate: false });
    expect(viewport.zoom()).toBe(1);
  });

  it("is a no-op while the content bounds are empty", () => {
    const { viewport, canvas } = setup({ content: undefined });
    expect(viewport.canFit()).toBe(false);
    viewport.fit();
    viewport.fit({ animate: false });
    expect(canvas.viewboxWrites).toEqual([]);
    expect(frames.pending).toBe(0);
  });

  it("animates over 250ms with the target as reference, without counting its frames as user moves", () => {
    const { viewport, canvas } = setup();
    viewport.fit();
    expect(canvas.viewboxWrites).toEqual([]);
    frames.run(START + FIT_ANIMATION_MS / 2);
    const middle = lastWrite(canvas);
    const target = expectedFit(canvas);
    expect(middle).toBeDefined();
    expect(middle).not.toEqual(target);
    const scale = canvas.viewbox().scale;
    expect(scale).toBeLessThan(1);
    expect(scale).toBeGreaterThan(target.width ? canvas.size.width / target.width : 0);
    expect(viewport.isAutomatic()).toBe(true);
    frames.run(START + FIT_ANIMATION_MS);
    expect(lastWrite(canvas)).toEqual(target);
    expect(frames.pending).toBe(0);
    expect(viewport.isAutomatic()).toBe(true);
  });

  it("jumps under reduced motion and with animate: false", () => {
    const reduced = setup({ prefersReducedMotion: () => true });
    reduced.viewport.fit();
    expect(lastWrite(reduced.canvas)).toEqual(expectedFit(reduced.canvas));
    expect(frames.pending).toBe(0);

    const explicit = setup();
    explicit.viewport.fit({ animate: false });
    expect(lastWrite(explicit.canvas)).toEqual(expectedFit(explicit.canvas));
    expect(frames.pending).toBe(0);
  });

  it("reads prefers-reduced-motion from matchMedia by default", () => {
    const matchMedia = vi.fn(() => ({ matches: true }) as MediaQueryList);
    vi.stubGlobal("matchMedia", matchMedia);
    const bus = new FakeEventBus();
    const canvas = new FakeCanvas(bus);
    const viewport = createViewport(
      { get: <T>(name: string) => ({ canvas, eventBus: bus })[name] as T },
      { contentBounds: () => CONTENT, insets: () => INSETS },
    );
    viewport.fit();
    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    expect(lastWrite(canvas)).toEqual(expectedFit(canvas));
  });

  it("jumps while <html> carries the host's reduced-motion class (VS Code workbench.reduceMotion)", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }) as MediaQueryList);
    const bus = new FakeEventBus();
    const canvas = new FakeCanvas(bus);
    const viewport = createViewport(
      { get: <T>(name: string) => ({ canvas, eventBus: bus })[name] as T },
      { contentBounds: () => CONTENT, insets: () => INSETS },
    );
    document.documentElement.classList.add("cd-shell-reduce-motion");
    try {
      viewport.fit();
      expect(lastWrite(canvas)).toEqual(expectedFit(canvas));
      expect(frames.pending).toBe(0);
    } finally {
      document.documentElement.classList.remove("cd-shell-reduce-motion");
    }
  });

  it.each([
    [
      "wheel",
      (container: HTMLElement) =>
        container.dispatchEvent(new WheelEvent("wheel", { bubbles: true })),
    ],
    [
      "pointerdown",
      (container: HTMLElement) =>
        container.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })),
    ],
    [
      "a zoom key",
      (container: HTMLElement) =>
        container.dispatchEvent(
          new KeyboardEvent("keydown", { key: "=", code: "Equal", metaKey: true }),
        ),
    ],
  ])("cancels the animation on %s", (_name, interrupt) => {
    const { viewport, canvas } = setup();
    viewport.fit();
    frames.run(START + 50);
    const writes = canvas.viewboxWrites.length;
    interrupt(canvas.container);
    expect(frames.pending).toBe(0);
    frames.run(START + FIT_ANIMATION_MS);
    expect(canvas.viewboxWrites).toHaveLength(writes);
    expect(viewport.isAutomatic()).toBe(true);
  });

  it("cancels the animation when the zoom target steps", () => {
    const { viewport, canvas, stepZoom } = setup();
    viewport.fit();
    frames.run(START + 50);
    viewport.stepZoom(1);
    expect(stepZoom).toHaveBeenCalledTimes(1);
    frames.run(START + FIT_ANIMATION_MS);
    expect(lastWrite(canvas)).not.toEqual(expectedFit(canvas));
    expect(viewport.isAutomatic()).toBe(false);
  });

  it("ends the animation when the user moves the view, and the move counts", () => {
    const { viewport, canvas } = setup();
    viewport.fit();
    frames.run(START + 50);
    canvas.pan(30, 0);
    expect(frames.pending).toBe(0);
    expect(viewport.isAutomatic()).toBe(false);
  });

  it("makes a moved view automatic again", () => {
    const { viewport, canvas } = setup();
    viewport.fit({ animate: false });
    canvas.pan(40, 10);
    expect(viewport.isAutomatic()).toBe(false);
    viewport.fit({ animate: false });
    expect(viewport.isAutomatic()).toBe(true);
  });
});

describe("afterImport", () => {
  it("jump-fits only the first import with content", () => {
    const { viewport, canvas, setContent } = setup({ content: undefined });
    viewport.afterImport();
    expect(canvas.viewboxWrites).toEqual([]);

    setContent(CONTENT);
    viewport.afterImport();
    expect(canvas.viewboxWrites).toEqual([expectedFit(canvas)]);
    expect(frames.pending).toBe(0);

    setContent({ x: 0, y: 0, width: 2000, height: 1500 });
    viewport.afterImport();
    expect(canvas.viewboxWrites).toHaveLength(1);
  });

  it("does not fit after setState", () => {
    const { viewport, canvas } = setup();
    viewport.setState({ viewbox: { x: -50, y: -40, width: 1000, height: 800 }, userMoved: false });
    viewport.afterImport();
    expect(canvas.viewboxWrites).toEqual([{ x: -50, y: -40, width: 1000, height: 800 }]);
  });

  it("does not fit once the user moved the view", () => {
    const { viewport, canvas, setContent } = setup({ content: undefined });
    viewport.afterImport();
    canvas.pan(20, 20);
    setContent(CONTENT);
    viewport.afterImport();
    expect(canvas.viewboxWrites).toEqual([]);
    expect(viewport.isAutomatic()).toBe(false);
  });

  it("does not fit after a restore once the first fit happened", () => {
    const { viewport, canvas } = setup();
    viewport.afterImport();
    const keep = viewport.getViewbox();
    if (!keep) throw new Error("no viewbox");
    canvas.pan(-200, 0);
    viewport.restore(keep);
    viewport.afterImport();
    expect(canvas.viewboxWrites).toHaveLength(2);
    expect(sameView(canvas.viewbox(), { ...keep, scale: canvas.size.width / keep.width })).toBe(
      true,
    );
  });

  it("still fits the first content of an empty file after the re-import restored its view", () => {
    const { viewport, canvas, setContent } = setup({ content: undefined });
    viewport.afterImport();
    const keep = viewport.getViewbox();
    if (!keep) throw new Error("no viewbox");
    setContent(CONTENT);
    viewport.restore(keep);
    viewport.afterImport();
    expect(lastWrite(canvas)).toEqual(expectedFit(canvas));
  });

  it("never fits content the user created on the canvas, so the next import keeps the view", () => {
    const { viewport, canvas, bus, setContent } = setup({ content: undefined });
    viewport.afterImport();
    // the first sticky from the palette, through the command stack, outside any import
    setContent({ x: 400, y: 300, width: 120, height: 80 });
    bus.fire("elements.changed", { elements: [] });
    // the user types in the text editor beside the board: an external import that keeps the view
    const keep = viewport.getViewbox();
    if (!keep) throw new Error("no viewbox");
    bus.fire("import.parse.start");
    setContent(CONTENT);
    bus.fire("import.done");
    viewport.restore(keep);
    viewport.afterImport();
    expect(canvas.viewboxWrites).toEqual([keep]);
    expect(viewport.isAutomatic()).toBe(true);
  });

  it("still fits the first content an import brings through the command stack", () => {
    const { viewport, canvas, bus, setContent } = setup({ content: undefined });
    viewport.afterImport();
    bus.fire("import.render.start");
    setContent(CONTENT);
    bus.fire("elements.changed", { elements: [] });
    bus.fire("import.done");
    viewport.afterImport();
    expect(lastWrite(canvas)).toEqual(expectedFit(canvas));
  });

  it("does not count content changes before the first import", () => {
    const { viewport, canvas, bus } = setup();
    bus.fire("elements.changed", { elements: [] });
    viewport.afterImport();
    expect(lastWrite(canvas)).toEqual(expectedFit(canvas));
  });

  it("ignores the viewbox a renderer sets while it imports", () => {
    const { viewport, canvas, bus } = setup();
    bus.fire("import.parse.start");
    bus.fire("import.render.start");
    canvas.viewbox({ x: 100, y: 100, width: 760, height: 320 });
    bus.fire("import.done");
    expect(viewport.isAutomatic()).toBe(true);
    viewport.afterImport();
    expect(lastWrite(canvas)).toEqual(expectedFit(canvas));
  });

  it("ends an import window that never got import.done on the next user input", () => {
    const { viewport, canvas, bus } = setup();
    bus.fire("import.parse.start");
    canvas.container.dispatchEvent(new PointerEvent("pointerdown"));
    canvas.pan(10, 0);
    expect(viewport.isAutomatic()).toBe(false);
  });

  it("waits for a container size before the first fit (hidden tab)", () => {
    const setupResult = setup();
    const { viewport, canvas } = setupResult;
    canvas.size = { width: 0, height: 0 };
    viewport.afterImport();
    expect(canvas.viewboxWrites).toEqual([]);
    resize(setupResult, 900, 700);
    expect(lastWrite(canvas)).toEqual(expectedFit(canvas));
  });

  it("stops an animated fit when the tab hides and fits once it is back", () => {
    const setupResult = setup();
    const { viewport, canvas } = setupResult;
    viewport.fit();
    frames.run(START + 50);
    const writes = canvas.viewboxWrites.length;
    canvas.size = { width: 0, height: 0 };
    frames.run(START + 100);
    expect(canvas.viewboxWrites).toHaveLength(writes);
    expect(frames.pending).toBe(0);
    resize(setupResult, 1000, 800);
    expect(lastWrite(canvas)).toEqual(expectedFit(canvas));
  });
});

describe("newDocument (web app: every new document opens like the first)", () => {
  it("fits the next import again after the user moved the view", () => {
    const { viewport, canvas, setContent } = setup();
    viewport.afterImport();
    canvas.pan(-300, 120);
    expect(viewport.isAutomatic()).toBe(false);

    const next: Bounds = { x: 0, y: 0, width: 600, height: 400 };
    viewport.newDocument();
    setContent(next);
    viewport.afterImport();
    expect(lastWrite(canvas)).toEqual(expectedFit(canvas, next));
    expect(viewport.isAutomatic()).toBe(true);
  });

  it("shows 100 % for an empty new document, whatever zoom the last one had", () => {
    const { viewport, canvas, setContent } = setup();
    viewport.afterImport();
    expect(viewport.zoom()).not.toBe(1);

    viewport.newDocument();
    setContent(undefined);
    viewport.afterImport();
    expect(viewport.zoom()).toBe(1);
    expect(canvas.viewboxWrites.length).toBeGreaterThan(1);
  });

  it("lets a stored view no longer win over the new document's fit", () => {
    const { viewport, canvas } = setup();
    viewport.setState({ viewbox: { x: -50, y: -40, width: 1000, height: 800 }, userMoved: true });
    viewport.newDocument();
    viewport.afterImport();
    expect(lastWrite(canvas)).toEqual(expectedFit(canvas));
  });
});

describe("afterImport: an empty file opens at 100 %", () => {
  /** What a renderer does while it imports an empty file: frames its board at its own zoom. */
  function importEmptyAt(setupResult: Setup, zoom: number): void {
    setupResult.bus.fire("import.parse.start");
    setupResult.canvas.zoom(zoom);
    setupResult.bus.fire("import.done");
  }

  it("zooms 118 % to 100 % around the centre of the free rectangle, as its own view", () => {
    const setupResult = setup({ content: undefined, deferUpdate: true });
    const { viewport, canvas } = setupResult;
    importEmptyAt(setupResult, 1.18);
    const centre = viewport.freeRectCenter();
    viewport.afterImport();
    // with deferUpdate the import's own viewbox event arrives after afterImport, carrying its view
    canvas.flushDeferred();
    expect(viewport.zoom()).toBe(1);
    expect(viewport.freeRectCenter()?.x).toBeCloseTo(centre?.x ?? Number.NaN, 2);
    expect(viewport.freeRectCenter()?.y).toBeCloseTo(centre?.y ?? Number.NaN, 2);
    expect(viewport.isAutomatic()).toBe(true);
    expect(frames.pending).toBe(0);
  });

  it("writes nothing when the import already left 100 %", () => {
    const { viewport, canvas } = setup({ content: undefined });
    viewport.afterImport();
    expect(canvas.viewboxWrites).toEqual([]);
    expect(viewport.zoom()).toBe(1);
  });

  it("keeps a stored view (setState)", () => {
    const { viewport, canvas } = setup({ content: undefined });
    const stored = { x: -50, y: -40, width: 1000 / 1.18, height: 800 / 1.18 };
    viewport.setState({ viewbox: stored, userMoved: false });
    viewport.afterImport();
    expect(canvas.viewboxWrites).toEqual([stored]);
    expect(viewport.zoom()).toBeCloseTo(1.18, 3);
  });

  it("keeps the view the user moved", () => {
    const { viewport, canvas } = setup({ content: undefined });
    canvas.zoom(1.18);
    viewport.afterImport();
    expect(canvas.viewboxWrites).toEqual([]);
    expect(viewport.zoom()).toBeCloseTo(1.18, 3);
    expect(viewport.isAutomatic()).toBe(false);
  });

  it("still fits the first content afterwards", () => {
    const setupResult = setup({ content: undefined });
    const { viewport, canvas, setContent } = setupResult;
    importEmptyAt(setupResult, 1.18);
    viewport.afterImport();
    expect(viewport.zoom()).toBe(1);
    setContent(CONTENT);
    viewport.afterImport();
    expect(lastWrite(canvas)).toEqual(expectedFit(canvas));
  });

  it("only acts on the first import: later imports and restores of the empty file keep the view", () => {
    const setupResult = setup({ content: undefined });
    const { viewport, canvas } = setupResult;
    importEmptyAt(setupResult, 1.18);
    viewport.afterImport();
    const keep = viewport.getViewbox();
    if (!keep) throw new Error("no viewbox");
    const writes = canvas.viewboxWrites.length;

    importEmptyAt(setupResult, 1.5);
    viewport.restore(keep);
    viewport.afterImport();
    expect(canvas.viewboxWrites).toHaveLength(writes + 1);
    expect(viewport.zoom()).toBe(1);

    importEmptyAt(setupResult, 1.5);
    viewport.afterImport();
    expect(canvas.viewboxWrites).toHaveLength(writes + 1);
    expect(viewport.zoom()).toBe(1.5);
  });

  it("waits for a container size (hidden tab)", () => {
    const setupResult = setup({ content: undefined });
    const { viewport, canvas } = setupResult;
    importEmptyAt(setupResult, 1.18);
    canvas.size = { width: 0, height: 0 };
    viewport.afterImport();
    expect(canvas.viewboxWrites).toEqual([]);
    resize(setupResult, 900, 700);
    expect(viewport.zoom()).toBe(1);
    expect(viewport.isAutomatic()).toBe(true);
  });

  it("fits instead when the first content arrives while the tab is still hidden", () => {
    const setupResult = setup({ content: undefined });
    const { viewport, canvas, setContent } = setupResult;
    canvas.size = { width: 0, height: 0 };
    importEmptyAt(setupResult, 1.18);
    viewport.afterImport();
    setContent(CONTENT);
    viewport.afterImport();
    resize(setupResult, 900, 700);
    expect(lastWrite(canvas)).toEqual(expectedFit(canvas));
  });
});

describe("freeRectCenter", () => {
  it("is the centre of the container minus the insets, in diagram coordinates", () => {
    const { viewport, canvas } = setup();
    expect(viewport.freeRectCenter()).toEqual({ x: 24 + 952 / 2, y: 88 + 648 / 2 });
    canvas.viewbox({ x: 200, y: -100, width: 2000, height: 1600 });
    const centre = viewport.freeRectCenter();
    expect(centre?.x).toBeCloseTo(200 + (24 + 952 / 2) * 2, 6);
    expect(centre?.y).toBeCloseTo(-100 + (88 + 648 / 2) * 2, 6);
  });

  it("reads the insets of the moment", () => {
    let insets: Insets = INSETS;
    const { viewport } = setup({ insets: () => insets });
    insets = { top: 140, right: 324, bottom: 64, left: 24 };
    expect(viewport.freeRectCenter()).toEqual({ x: 24 + 652 / 2, y: 140 + 596 / 2 });
  });

  it("is where a fit puts the centre of the content", () => {
    const { viewport, canvas } = setup();
    viewport.fit({ animate: false });
    canvas.flushDeferred();
    const centre = viewport.freeRectCenter();
    // diagram-js rounds the scale to three decimals
    expect(centre?.x).toBeCloseTo(CONTENT.x + CONTENT.width / 2, 0);
    expect(centre?.y).toBeCloseTo(CONTENT.y + CONTENT.height / 2, 0);
  });

  it("is undefined at 0 × 0 and after destroy", () => {
    const { viewport, canvas } = setup();
    canvas.size = { width: 0, height: 0 };
    expect(viewport.freeRectCenter()).toBeUndefined();
    canvas.size = { width: 1000, height: 800 };
    expect(viewport.freeRectCenter()).toBeDefined();
    viewport.destroy();
    expect(viewport.freeRectCenter()).toBeUndefined();
  });
});

describe("focus", () => {
  it("hands the focus to the canvas through canvas.focus(), until destroy", () => {
    const { viewport, canvas } = setup();
    const focus = vi.fn();
    Object.assign(canvas, { focus });
    viewport.focus?.();
    expect(focus).toHaveBeenCalledTimes(1);
    viewport.destroy();
    viewport.focus?.();
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it("is a no-op on a canvas without focus()", () => {
    const { viewport } = setup();
    expect(() => viewport.focus?.()).not.toThrow();
  });

  it("is optional, so a Viewport fake written against 0.2.1 still compiles", () => {
    expectTypeOf<Omit<Viewport, "focus">>().toExtend<Viewport>();
  });
});

describe("user moves", () => {
  it("recognises the own change in a delayed changed event (deferUpdate)", () => {
    const { viewport, canvas } = setup({ deferUpdate: true });
    viewport.fit({ animate: false });
    canvas.flushDeferred();
    expect(viewport.isAutomatic()).toBe(true);

    canvas.pan(25, -10);
    expect(viewport.isAutomatic()).toBe(true);
    canvas.flushDeferred();
    expect(viewport.isAutomatic()).toBe(false);
  });

  it("recognises the delayed event of an animated fit", () => {
    const { viewport, canvas } = setup({ deferUpdate: true });
    viewport.fit();
    frames.run(START + 100);
    canvas.flushDeferred();
    expect(viewport.isAutomatic()).toBe(true);
    frames.run(START + FIT_ANIMATION_MS);
    canvas.flushDeferred();
    expect(viewport.isAutomatic()).toBe(true);
  });

  it("absorbs the getter's rounding near the origin at low zoom", () => {
    const size = { width: 1000, height: 800 };
    const probe = fitViewbox({ x: 0, y: 0, width: 9000, height: 7000 }, size, INSETS);
    if (!probe) throw new Error("nothing to fit");
    // Content placed so the fitted viewbox starts 0.003 diagram units from the origin.
    const content = { x: 0.003 - probe.x, y: 0.003 - probe.y, width: 9000, height: 7000 };
    const target = fitViewbox(content, size, INSETS);
    const { viewport, canvas } = setup({ content, deferUpdate: true });
    viewport.fit({ animate: false });
    canvas.flushDeferred();
    const shown = canvas.viewbox();
    expect(shown.scale).toBeLessThan(0.2);
    expect(target?.x).toBeCloseTo(0.003, 6);
    expect(Math.abs(shown.x - (target?.x ?? 0))).toBeGreaterThan(1e-3);
    expect(viewport.isAutomatic()).toBe(true);
  });

  it("keeps the user-move state through a restore and takes the restored view as reference", () => {
    const moved = setup({ deferUpdate: true });
    moved.viewport.fit({ animate: false });
    moved.canvas.pan(50, 0);
    moved.canvas.flushDeferred();
    expect(moved.viewport.isAutomatic()).toBe(false);
    moved.viewport.restore({ x: 10, y: 20, width: 1000, height: 800 });
    moved.canvas.flushDeferred();
    expect(moved.viewport.isAutomatic()).toBe(false);

    const untouched = setup({ deferUpdate: true });
    untouched.viewport.fit({ animate: false });
    untouched.viewport.restore({ x: 10, y: 20, width: 1000, height: 800 });
    untouched.canvas.flushDeferred();
    expect(untouched.viewport.isAutomatic()).toBe(true);
  });

  it("does not count canvas.resized side effects (keep-selection-visible) as moves", () => {
    const setupResult = setup();
    const { viewport, canvas, bus } = setupResult;
    viewport.fit({ animate: false });
    bus.on("canvas.resized", () => canvas.pan(5, 5));
    (viewport as unknown as { resized(): void }).resized();
    expect(viewport.isAutomatic()).toBe(true);
  });
});

describe("resize", () => {
  it("skips 0 × 0, calls canvas.resized and refits while automatic", () => {
    const setupResult = setup();
    const { viewport, canvas } = setupResult;
    viewport.afterImport();
    const writes = canvas.viewboxWrites.length;

    resize(setupResult, 0, 0);
    expect(canvas.resizedCalls).toBe(0);
    expect(canvas.viewboxWrites).toHaveLength(writes);

    resize(setupResult, 1000, 800);
    expect(canvas.resizedCalls).toBe(0);
    expect(canvas.viewboxWrites).toHaveLength(writes);

    resize(setupResult, 700, 600);
    expect(canvas.resizedCalls).toBe(1);
    expect(lastWrite(canvas)).toEqual(expectedFit(canvas));
  });

  it("coalesces the observer's entries to one per frame", () => {
    const setupResult = setup();
    const { viewport, canvas, observer } = setupResult;
    viewport.afterImport();
    canvas.size = { width: 640, height: 480 };
    observer.notify();
    observer.notify();
    expect(frames.pending).toBe(1);
    frames.run(START);
    expect(canvas.resizedCalls).toBe(1);
  });

  it("calls canvas.resized but keeps the view once the user moved it", () => {
    const setupResult = setup();
    const { viewport, canvas } = setupResult;
    viewport.afterImport();
    canvas.pan(80, 0);
    const writes = canvas.viewboxWrites.length;
    resize(setupResult, 640, 480);
    expect(canvas.resizedCalls).toBe(1);
    expect(canvas.viewboxWrites).toHaveLength(writes);
    expect(viewport.isAutomatic()).toBe(false);
  });

  it("does not fit before the first import", () => {
    const setupResult = setup();
    resize(setupResult, 640, 480);
    expect(setupResult.canvas.viewboxWrites).toEqual([]);
  });

  it("observes the canvas container", () => {
    const { canvas, observer } = setup();
    expect(observer.observed).toEqual([canvas.container]);
  });
});

describe("refitIfOnlyInsetChanged (chrome that settles after a fit)", () => {
  const OPEN_LEGEND: Insets = { ...INSETS, left: 12 + 230 + 24 };
  const SETTLED_LEGEND: Insets = { ...INSETS, left: 12 + 231.6 + 24 };

  function settling(options: Parameters<typeof setup>[0] = {}) {
    let insets = OPEN_LEGEND;
    const setupResult = setup({ ...options, insets: () => insets });
    return {
      ...setupResult,
      viewport: setupResult.viewport as DiagramViewport,
      settle(next: Insets = SETTLED_LEGEND) {
        insets = next;
      },
    };
  }

  it("fits again (jump) with the insets of now when they changed since the fit", () => {
    const { viewport, canvas, settle } = settling();
    viewport.afterImport();
    expect(lastWrite(canvas)).toEqual(expectedFit(canvas, CONTENT, OPEN_LEGEND));

    settle();
    expect(viewport.refitIfOnlyInsetChanged("left")).toBe(true);
    expect(lastWrite(canvas)).toEqual(expectedFit(canvas, CONTENT, SETTLED_LEGEND));
    expect(frames.pending).toBe(0);
    expect(viewport.isAutomatic()).toBe(true);
  });

  it("writes nothing while the insets are still the fit's", () => {
    const { viewport, canvas } = settling();
    viewport.afterImport();
    expect(viewport.refitIfOnlyInsetChanged("left")).toBe(false);
    expect(canvas.viewboxWrites).toHaveLength(1);
  });

  it("keeps the view when another side changed: the inspector, the pill, the palette row (guide §5.9)", () => {
    const { viewport, canvas, settle } = settling();
    viewport.afterImport();
    settle({ ...OPEN_LEGEND, right: 12 + 288 + 24 });
    expect(viewport.refitIfOnlyInsetChanged("left")).toBe(false);
    settle({ ...SETTLED_LEGEND, bottom: 92 });
    expect(viewport.refitIfOnlyInsetChanged("left")).toBe(false);
    settle({ ...SETTLED_LEGEND, top: 140 });
    expect(viewport.refitIfOnlyInsetChanged("left")).toBe(false);
    expect(canvas.viewboxWrites).toHaveLength(1);
    expect(viewport.isAutomatic()).toBe(true);
  });

  it("fits only once per change: the refit's insets are the ones it compares with next", () => {
    const { viewport, canvas, settle } = settling();
    viewport.afterImport();
    settle();
    viewport.refitIfOnlyInsetChanged("left");
    expect(viewport.refitIfOnlyInsetChanged("left")).toBe(false);
    expect(canvas.viewboxWrites).toHaveLength(2);
  });

  it("counts a resize refit as the fit to compare with", () => {
    const setupResult = settling();
    const { viewport, canvas, settle } = setupResult;
    viewport.afterImport();
    settle();
    resize(setupResult, 900, 700);
    expect(lastWrite(canvas)).toEqual(expectedFit(canvas, CONTENT, SETTLED_LEGEND));
    expect(viewport.refitIfOnlyInsetChanged("left")).toBe(false);
  });

  it("leaves a container resize to the resize refit, which also calls canvas.resized", () => {
    const setupResult = settling();
    const { viewport, canvas, settle, observer } = setupResult;
    viewport.afterImport();
    settle();
    canvas.size = { width: 900, height: 700 };
    expect(viewport.refitIfOnlyInsetChanged("left")).toBe(false);
    expect(canvas.viewboxWrites).toHaveLength(1);
    observer.notify();
    frames.run(START);
    expect(canvas.resizedCalls).toBe(1);
    expect(lastWrite(canvas)).toEqual(expectedFit(canvas, CONTENT, SETTLED_LEGEND));
  });

  it("retargets an explicit fit that is still animating", () => {
    const { viewport, canvas, settle } = settling();
    viewport.fit();
    frames.run(START + 50);
    settle();
    expect(viewport.refitIfOnlyInsetChanged("left")).toBe(true);
    expect(frames.pending).toBe(1);
    frames.run(START + 50 + FIT_ANIMATION_MS);
    expect(lastWrite(canvas)).toEqual(expectedFit(canvas, CONTENT, SETTLED_LEGEND));
    expect(viewport.isAutomatic()).toBe(true);
  });

  it("keeps the view once the content bounds differ from the fit's: an edit never fits (guide §5.9)", () => {
    const { viewport, canvas, settle, setContent } = settling();
    viewport.afterImport();
    setContent({ x: 100, y: 100, width: 5000, height: 3000 });
    settle();
    expect(viewport.refitIfOnlyInsetChanged("left")).toBe(false);
    setContent({ x: 100, y: 100, width: 900, height: 600 });
    expect(viewport.refitIfOnlyInsetChanged("left")).toBe(false);
    setContent(undefined);
    expect(viewport.refitIfOnlyInsetChanged("left")).toBe(false);
    expect(canvas.viewboxWrites).toHaveLength(1);
    expect(viewport.isAutomatic()).toBe(true);

    setContent({ ...CONTENT });
    expect(viewport.refitIfOnlyInsetChanged("left")).toBe(true);
    expect(lastWrite(canvas)).toEqual(expectedFit(canvas, CONTENT, SETTLED_LEGEND));
  });

  it("keeps a view the user zoomed or panned since the fit", () => {
    const zoomed = settling();
    zoomed.viewport.afterImport();
    zoomed.viewport.stepZoom(1);
    zoomed.settle();
    expect(zoomed.viewport.refitIfOnlyInsetChanged("left")).toBe(false);
    expect(zoomed.canvas.viewboxWrites).toHaveLength(1);

    const panned = settling();
    panned.viewport.afterImport();
    panned.canvas.pan(40, 0);
    panned.settle();
    expect(panned.viewport.refitIfOnlyInsetChanged("left")).toBe(false);
    expect(panned.canvas.viewboxWrites).toHaveLength(1);
  });

  it("keeps a view a pointer stopped short of the fit's target", () => {
    const { viewport, canvas, settle } = settling();
    viewport.fit();
    frames.run(START + 50);
    canvas.container.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    const writes = canvas.viewboxWrites.length;
    settle();
    expect(viewport.refitIfOnlyInsetChanged("left")).toBe(false);
    expect(canvas.viewboxWrites).toHaveLength(writes);
  });

  it("keeps views no fit set: before the first fit, restored, stored, a new document's", () => {
    const before = settling();
    before.settle();
    expect(before.viewport.refitIfOnlyInsetChanged("left")).toBe(false);
    expect(before.canvas.viewboxWrites).toEqual([]);

    const restored = settling();
    restored.viewport.afterImport();
    const keep = restored.viewport.getViewbox();
    if (!keep) throw new Error("no viewbox");
    restored.viewport.restore(keep);
    restored.settle();
    expect(restored.viewport.refitIfOnlyInsetChanged("left")).toBe(false);
    expect(restored.canvas.viewboxWrites).toHaveLength(2);

    const stored = settling();
    stored.viewport.setState({
      viewbox: { x: 0, y: 0, width: 1000, height: 800 },
      userMoved: false,
    });
    stored.viewport.afterImport();
    stored.settle();
    expect(stored.viewport.refitIfOnlyInsetChanged("left")).toBe(false);
    expect(stored.canvas.viewboxWrites).toHaveLength(1);

    const next = settling();
    next.viewport.afterImport();
    next.viewport.newDocument();
    next.settle();
    expect(next.viewport.refitIfOnlyInsetChanged("left")).toBe(false);
    expect(next.canvas.viewboxWrites).toHaveLength(1);
  });

  it("is a no-op after destroy", () => {
    const { viewport, canvas, settle } = settling();
    viewport.afterImport();
    viewport.destroy();
    settle();
    expect(viewport.refitIfOnlyInsetChanged("left")).toBe(false);
    expect(canvas.viewboxWrites).toHaveLength(1);
  });
});

describe("state", () => {
  it("is undefined before the first import", () => {
    const { viewport } = setup();
    expect(viewport.getState()).toBeUndefined();
  });

  it("round-trips through getState and setState", () => {
    const first = setup();
    first.viewport.afterImport();
    first.canvas.pan(-120, 35);
    const state = first.viewport.getState();
    expect(state?.userMoved).toBe(true);
    const json = JSON.parse(JSON.stringify(state)) as typeof state;
    if (!json) throw new Error("no state");

    const second = setup();
    second.viewport.setState(json);
    second.viewport.afterImport();
    expect(second.viewport.isAutomatic()).toBe(false);
    const restored = second.viewport.getState();
    expect(restored?.userMoved).toBe(true);
    expect(restored?.viewbox.x).toBeCloseTo(json.viewbox.x, 2);
    expect(restored?.viewbox.y).toBeCloseTo(json.viewbox.y, 2);
    expect(restored?.viewbox.width).toBeCloseTo(json.viewbox.width, 2);
  });

  it("reports the viewbox for the current container size, undefined at 0 × 0", () => {
    const { viewport, canvas } = setup();
    viewport.fit({ animate: false });
    const scale = canvas.viewbox().scale;
    expect(viewport.getViewbox()?.width).toBeCloseTo(canvas.size.width / scale, 6);
    canvas.size = { width: 0, height: 0 };
    expect(viewport.getViewbox()).toBeUndefined();
  });

  it("applies a view set in a hidden tab once the container has a size", () => {
    const setupResult = setup();
    const { viewport, canvas } = setupResult;
    canvas.size = { width: 0, height: 0 };
    const viewbox = { x: 5, y: 6, width: 900, height: 700 };
    viewport.setState({ viewbox, userMoved: true });
    expect(canvas.viewboxWrites).toEqual([]);
    expect(viewport.getState()).toEqual({ viewbox, userMoved: true });
    resize(setupResult, 900, 700);
    expect(canvas.viewboxWrites).toEqual([viewbox]);
  });

  it("does not refit an automatic stored view the moment the hidden tab shows", () => {
    const setupResult = setup();
    const { viewport, canvas } = setupResult;
    canvas.size = { width: 0, height: 0 };
    const viewbox = { x: 5, y: 6, width: 900, height: 700 };
    viewport.setState({ viewbox, userMoved: false });
    viewport.afterImport();
    resize(setupResult, 900, 700);
    expect(canvas.viewboxWrites).toEqual([viewbox]);
    resize(setupResult, 800, 700);
    expect(lastWrite(canvas)).toEqual(expectedFit(canvas));
  });
});

describe("onChange", () => {
  it("notifies on viewbox changes, content changes and imports until unsubscribed", () => {
    const { viewport, canvas, bus } = setup({ deferUpdate: true });
    const listener = vi.fn();
    const unsubscribe = viewport.onChange(listener);
    canvas.pan(1, 1);
    expect(listener).toHaveBeenCalledTimes(1);
    canvas.flushDeferred();
    expect(listener).toHaveBeenCalledTimes(2);
    bus.fire("elements.changed", { elements: [] });
    viewport.afterImport();
    expect(listener.mock.calls.length).toBeGreaterThanOrEqual(4);
    unsubscribe();
    listener.mockClear();
    canvas.pan(1, 1);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("canFit", () => {
  it("reads the content bounds once per content change, not on every frame", () => {
    const contentBounds = vi.fn(() => CONTENT);
    const { viewport, bus, canvas } = setup({ contentBounds });
    for (let frame = 0; frame < 5; frame++) {
      canvas.pan(1, 0);
      expect(viewport.canFit()).toBe(true);
    }
    expect(contentBounds).toHaveBeenCalledTimes(1);
    for (const event of [
      "elements.changed",
      "shape.added",
      "shape.removed",
      "import.done",
      "diagram.clear",
    ]) {
      bus.fire(event, { elements: [] });
      viewport.canFit();
      viewport.canFit();
    }
    expect(contentBounds).toHaveBeenCalledTimes(6);
  });
});

describe("destroy", () => {
  it("destroys itself on diagram.destroy and stays safe to ask", () => {
    const { viewport, canvas, bus, observer } = setup();
    viewport.afterImport();
    const zoom = viewport.zoom();
    bus.fire("diagram.destroy");
    expect(observer.disconnected).toBe(true);
    expect(bus.count()).toBe(0);
    canvas.zoom = () => {
      throw new TypeError("destroyed canvas");
    };
    expect(viewport.zoom()).toBe(zoom);
    expect(viewport.canFit()).toBe(false);
    expect(viewport.getViewbox()).toBeUndefined();
    expect(viewport.getState()).toBeUndefined();
    expect(() => viewport.stepZoom(1)).not.toThrow();
  });

  it("disconnects observer, listeners and a running animation", () => {
    const { viewport, canvas, bus, observer } = setup();
    const listener = vi.fn();
    viewport.onChange(listener);
    viewport.fit();
    frames.run(START + 50);
    const writes = canvas.viewboxWrites.length;
    listener.mockClear();

    viewport.destroy();
    viewport.destroy();
    expect(observer.disconnected).toBe(true);
    expect(bus.count()).toBe(0);
    expect(frames.pending).toBe(0);
    frames.run(START + FIT_ANIMATION_MS);
    expect(canvas.viewboxWrites).toHaveLength(writes);

    canvas.pan(10, 10);
    viewport.stepZoom(1);
    viewport.fit();
    viewport.afterImport();
    expect(listener).not.toHaveBeenCalled();
    expect(canvas.viewboxWrites).toHaveLength(writes);
  });
});
