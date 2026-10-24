import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fitViewbox, SHELL, type Bounds } from "../core/index.js";
import { FakeCanvas, FakeEventBus, FrameQueue } from "../../test/support/diagram-js.js";
import {
  FakeResizeObserver,
  cleanup,
  installFakes,
  mount,
  setBox,
} from "../../test/support/dom.js";
import { connectDiagramJs } from "./connect.js";

const CONTENT: Bounds = { x: 100, y: 100, width: 1900, height: 900 };
/** The open card before and after its font has loaded (Context Maps: about 1.6px). */
const FALLBACK_WIDTH = 230;
const SETTLED_WIDTH = 231.6;
const CARD_HEIGHT = 240;

/** `document.fonts` under test control: `startLoading()` begins a font load, `finish()` ends it. */
class FakeFontFaceSet {
  status: FontFaceSetLoadStatus = "loaded";
  ready: Promise<FakeFontFaceSet> = Promise.resolve(this);
  private resolveReady: (() => void) | undefined;

  startLoading(): void {
    this.status = "loading";
    this.ready = new Promise((resolve) => {
      this.resolveReady = () => resolve(this);
    });
  }

  finish(): void {
    this.status = "loaded";
    this.resolveReady?.();
  }
}

let frames: FrameQueue;
let fonts: FakeFontFaceSet;

beforeEach(() => {
  installFakes();
  frames = new FrameQueue();
  vi.stubGlobal("requestAnimationFrame", frames.request);
  vi.stubGlobal("cancelAnimationFrame", frames.cancel);
  fonts = new FakeFontFaceSet();
  Object.defineProperty(document, "fonts", { configurable: true, value: fonts });
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(document, "fonts");
});

function settledPromises(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/** Lets the `fonts.ready` callbacks run, then the two frames after them. */
async function afterFontsAndTwoFrames(): Promise<void> {
  await settledPromises();
  frames.run(0);
  frames.run(16);
}

function connected(legendOpen: boolean) {
  const { shell } = mount({
    legend: { render() {}, open: legendOpen },
    inspector: { label: "Properties" },
  });
  const legend = shell.legend;
  if (!legend) throw new Error("no legend");
  const setLegendBox = (width: number, height = CARD_HEIGHT) =>
    setBox(legend.element, { left: SHELL.edge, top: 500, width, height });
  setLegendBox(FALLBACK_WIDTH);
  const bus = new FakeEventBus();
  const canvas = new FakeCanvas(bus);
  const services: Record<string, unknown> = {
    canvas,
    eventBus: bus,
    modelerShell: { attachShell: () => () => undefined },
  };
  const diagram = { get: <T>(name: string) => services[name] as T };
  let content = CONTENT;
  const connection = connectDiagramJs(shell, diagram, { contentBounds: () => content });
  const watches = () =>
    FakeResizeObserver.instances.some((observer) => observer.observed.has(legend.element));
  /** The card changes its size; the observer reports it. */
  const settle = (width: number, height?: number) => {
    setLegendBox(width, height);
    FakeResizeObserver.resize(legend.element);
  };
  /** The user changes the content on the canvas: diagram-js reports the shape, then the change. */
  const edit = (event: "shape.added" | "shape.removed", bounds: Bounds) => {
    content = bounds;
    bus.fire(event, { element: {} });
    bus.fire("elements.changed", { elements: [{}] });
  };
  return { shell, legend, canvas, connection, watches, settle, edit };
}

function fitWithLegend(canvas: FakeCanvas, legendWidth: number | undefined): Bounds {
  const left =
    legendWidth === undefined ? SHELL.fitInsetSide : SHELL.edge + legendWidth + SHELL.fitInsetSide;
  const box = fitViewbox(CONTENT, canvas.getSize(), {
    top: SHELL.fitInsetTop,
    right: SHELL.fitInsetSide,
    bottom: SHELL.fitInsetBottom,
    left,
  });
  if (!box) throw new Error("nothing to fit");
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

describe("connectDiagramJs: an open legend that settles after the first fit", () => {
  it("fits once more with the settled width while the font loads, then stops watching", () => {
    fonts.startLoading();
    const { canvas, connection, watches, settle } = connected(true);
    connection.viewport.afterImport();
    expect(canvas.viewboxWrites).toEqual([fitWithLegend(canvas, FALLBACK_WIDTH)]);

    settle(SETTLED_WIDTH);
    expect(canvas.viewboxWrites).toEqual([
      fitWithLegend(canvas, FALLBACK_WIDTH),
      fitWithLegend(canvas, SETTLED_WIDTH),
    ]);
    expect(connection.viewport.isAutomatic()).toBe(true);
    expect(watches()).toBe(false);

    settle(260);
    expect(canvas.viewboxWrites).toHaveLength(2);
  });

  it("keeps watching through a size report that changes nothing, and before the first fit", () => {
    fonts.startLoading();
    const { canvas, connection, watches, settle } = connected(true);
    settle(SETTLED_WIDTH);
    expect(canvas.viewboxWrites).toEqual([]);
    connection.viewport.afterImport();
    settle(SETTLED_WIDTH);
    expect(canvas.viewboxWrites).toEqual([fitWithLegend(canvas, SETTLED_WIDTH)]);
    expect(watches()).toBe(true);
  });

  it("keeps the view when only the card's height changes", () => {
    fonts.startLoading();
    const { canvas, connection, watches, settle } = connected(true);
    connection.viewport.afterImport();
    settle(FALLBACK_WIDTH, 180);
    expect(canvas.viewboxWrites).toHaveLength(1);
    expect(watches()).toBe(true);
  });

  it("keeps the view once another inset changed: opening the inspector never fits (guide §5.9)", () => {
    fonts.startLoading();
    const { shell, canvas, connection, settle } = connected(true);
    connection.viewport.afterImport();
    shell.inspector?.open();
    settle(SETTLED_WIDTH, 180);
    expect(canvas.viewboxWrites).toHaveLength(1);
    expect(connection.viewport.isAutomatic()).toBe(true);
  });

  it("stops watching once the fonts have loaded: a later change of the card keeps the view", async () => {
    fonts.startLoading();
    const { canvas, connection, watches, settle } = connected(true);
    connection.viewport.afterImport();
    fonts.finish();
    await afterFontsAndTwoFrames();
    expect(watches()).toBe(false);
    settle(SETTLED_WIDTH);
    expect(canvas.viewboxWrites).toHaveLength(1);
  });

  it("fits for a card the frame after the fonts loaded reports, then stops", async () => {
    fonts.startLoading();
    const { canvas, connection, watches, settle } = connected(true);
    connection.viewport.afterImport();
    fonts.finish();
    await settledPromises();
    frames.run(0);
    settle(SETTLED_WIDTH);
    expect(canvas.viewboxWrites).toEqual([
      fitWithLegend(canvas, FALLBACK_WIDTH),
      fitWithLegend(canvas, SETTLED_WIDTH),
    ]);
    expect(watches()).toBe(false);
  });

  it("waits for a font that starts loading while it waits", async () => {
    const { canvas, connection, watches, settle } = connected(true);
    connection.viewport.afterImport();
    fonts.startLoading();
    await afterFontsAndTwoFrames();
    expect(watches()).toBe(true);
    settle(SETTLED_WIDTH);
    expect(canvas.viewboxWrites).toHaveLength(2);
  });

  it("stops two frames after the connection without a fit when the fonts had loaded", async () => {
    const { canvas, connection, watches, settle } = connected(true);
    connection.viewport.afterImport();
    await afterFontsAndTwoFrames();
    expect(watches()).toBe(false);
    settle(SETTLED_WIDTH);
    expect(canvas.viewboxWrites).toHaveLength(1);
  });

  it("keeps the view when the user added content since the fit: creating never fits (guide §5.9)", () => {
    fonts.startLoading();
    const { canvas, connection, settle, edit } = connected(true);
    connection.viewport.afterImport();
    edit("shape.added", { x: 100, y: 100, width: 5000, height: 3000 });
    settle(SETTLED_WIDTH);
    expect(canvas.viewboxWrites).toEqual([fitWithLegend(canvas, FALLBACK_WIDTH)]);
    expect(connection.viewport.isAutomatic()).toBe(true);
  });

  it("keeps the view when the user deleted content since the fit (guide §5.9)", () => {
    fonts.startLoading();
    const { canvas, connection, settle, edit } = connected(true);
    connection.viewport.afterImport();
    edit("shape.removed", { x: 100, y: 100, width: 900, height: 600 });
    settle(SETTLED_WIDTH);
    expect(canvas.viewboxWrites).toEqual([fitWithLegend(canvas, FALLBACK_WIDTH)]);
  });

  it("still fits for the card after an edit that left the content bounds as the fit measured them", () => {
    fonts.startLoading();
    const { canvas, connection, settle, edit } = connected(true);
    connection.viewport.afterImport();
    edit("shape.added", { ...CONTENT });
    settle(SETTLED_WIDTH);
    expect(canvas.viewboxWrites).toEqual([
      fitWithLegend(canvas, FALLBACK_WIDTH),
      fitWithLegend(canvas, SETTLED_WIDTH),
    ]);
  });

  it("keeps a view the user zoomed since the fit, and stops watching", () => {
    fonts.startLoading();
    const { canvas, connection, watches, settle } = connected(true);
    connection.viewport.afterImport();
    connection.viewport.stepZoom(-1);
    expect(watches()).toBe(false);
    const writes = canvas.viewboxWrites.length;
    settle(SETTLED_WIDTH);
    expect(canvas.viewboxWrites).toHaveLength(writes);
  });

  it("keeps a view the user panned since the fit, and stops watching", () => {
    fonts.startLoading();
    const { canvas, connection, watches, settle } = connected(true);
    connection.viewport.afterImport();
    canvas.pan(40, 0);
    expect(watches()).toBe(false);
    settle(SETTLED_WIDTH);
    expect(canvas.viewboxWrites).toHaveLength(1);
  });

  it("does not watch a legend that starts closed: opening it never fits (guide §5.9)", () => {
    fonts.startLoading();
    const { legend, canvas, connection, watches, settle } = connected(false);
    expect(watches()).toBe(false);
    connection.viewport.afterImport();
    legend.setOpen(true);
    settle(SETTLED_WIDTH);
    expect(canvas.viewboxWrites).toEqual([fitWithLegend(canvas, undefined)]);
  });

  it("stops watching when the legend closes, so reopening it never fits (guide §5.9)", () => {
    fonts.startLoading();
    const { legend, canvas, connection, watches, settle } = connected(true);
    connection.viewport.afterImport();
    legend.setOpen(false);
    settle(0);
    expect(watches()).toBe(false);
    legend.setOpen(true);
    settle(SETTLED_WIDTH);
    expect(canvas.viewboxWrites).toHaveLength(1);
  });

  it("stops watching with the connection, the wait for the fonts included", async () => {
    fonts.startLoading();
    const { canvas, connection, watches, settle } = connected(true);
    connection.viewport.afterImport();
    fonts.finish();
    await settledPromises();
    expect(frames.pending).toBeGreaterThan(0);
    connection.destroy();
    expect(watches()).toBe(false);
    expect(frames.pending).toBe(0);
    settle(SETTLED_WIDTH);
    expect(canvas.viewboxWrites).toHaveLength(1);
  });
});
