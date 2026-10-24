// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import EventBus from "diagram-js/lib/core/EventBus";
import EventStormingDrawTool from "../src/draw-tool/EventStormingDrawTool.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function harness() {
  const modelerContainer = document.createElement("div");
  modelerContainer.className = "event-storming-container";
  const canvasContainer = document.createElement("div");
  const svg = document.createElementNS(SVG_NS, "svg");
  const layer = document.createElementNS(SVG_NS, "g");
  svg.append(layer);
  const paletteEntry = document.createElement("div");
  paletteEntry.className = "entry";
  paletteEntry.tabIndex = 0;
  const palette = document.createElement("div");
  palette.className = "djs-palette";
  palette.append(paletteEntry);
  const labelField = document.createElement("textarea");
  canvasContainer.append(svg, palette, labelField);
  modelerContainer.append(canvasContainer);
  const hostField = document.createElement("input");
  const hostButton = document.createElement("button");
  document.body.append(modelerContainer, hostField, hostButton);

  const eventBus = new EventBus();
  const canvas = {
    getContainer: () => canvasContainer,
    getLayer: () => layer,
    getRootElement: () => ({ id: "root" }),
    viewbox: () => ({ x: 0, y: 0 }),
    zoom: () => 1,
    focus: vi.fn(),
  };
  const modeling = { createShape: vi.fn((shape: unknown) => shape) };
  const factory = {
    drawingFromCanvasPoints: vi.fn(() => ({ x: 0, y: 0, width: 10, height: 10 })),
  };
  const drawTool = new EventStormingDrawTool(
    canvas as never,
    eventBus,
    modeling as never,
    { select: vi.fn() } as never,
    factory as never,
  );

  cleanups.push(() => {
    eventBus.fire("diagram.destroy");
    modelerContainer.remove();
    hostField.remove();
    hostButton.remove();
  });

  const pointAt = (x: number, y: number) =>
    svg.dispatchEvent(
      new MouseEvent("mousedown", { button: 0, clientX: x, clientY: y, bubbles: true }),
    );

  return {
    drawTool,
    canvas,
    modeling,
    svg,
    paletteEntry,
    labelField,
    hostField,
    hostButton,
    pointAt,
  };
}

function press(target: EventTarget, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe("EventStormingDrawTool: Enter and Escape", () => {
  it("finishes the line on Enter and cancels on Escape aimed at the canvas", () => {
    const { drawTool, modeling, svg, pointAt } = harness();
    drawTool.activate();
    pointAt(10, 10);
    pointAt(60, 40);
    expect(press(svg, "Enter").defaultPrevented).toBe(true);
    expect(drawTool.isActive()).toBe(false);
    expect(modeling.createShape).toHaveBeenCalledTimes(1);

    drawTool.activate();
    expect(press(svg, "Escape").defaultPrevented).toBe(true);
    expect(drawTool.isActive()).toBe(false);
  });

  // Enter on the palette's Draw entry leaves the focus there (guide §5.5, §5.8).
  it("cancels on Escape aimed at the palette entry that started the tool", () => {
    const { drawTool, paletteEntry } = harness();
    drawTool.activate();
    expect(press(paletteEntry, "Escape").defaultPrevented).toBe(true);
    expect(drawTool.isActive()).toBe(false);
  });

  // Issue #91: a host field, the zoom buttons, an open menu or dialog keep their Enter and Escape.
  it("leaves Enter and Escape aimed outside the modeler to their target", () => {
    const { drawTool, modeling, hostField, hostButton, pointAt } = harness();
    drawTool.activate();
    pointAt(10, 10);
    pointAt(60, 40);
    for (const target of [hostField, hostButton, document.body]) {
      expect(press(target, "Enter").defaultPrevented).toBe(false);
      expect(press(target, "Escape").defaultPrevented).toBe(false);
    }
    expect(drawTool.isActive()).toBe(true);
    expect(modeling.createShape).not.toHaveBeenCalled();
  });

  it("leaves Enter and Escape in a text field inside the modeler to the field", () => {
    const { drawTool, labelField } = harness();
    drawTool.activate();
    expect(press(labelField, "Enter").defaultPrevented).toBe(false);
    expect(press(labelField, "Escape").defaultPrevented).toBe(false);
    expect(drawTool.isActive()).toBe(true);
  });

  it("leaves an Enter that ends an IME composition to the input method", () => {
    const { drawTool, svg, pointAt } = harness();
    drawTool.activate();
    pointAt(10, 10);
    pointAt(60, 40);
    expect(press(svg, "Enter", { isComposing: true }).defaultPrevented).toBe(false);
    expect(drawTool.isActive()).toBe(true);
  });
});

describe("EventStormingDrawTool: focus", () => {
  // The tool prevents the mousedown's default, the browser's own focus move to the canvas.
  it("focuses the canvas on every point, so Enter and Escape reach the tool", () => {
    const { drawTool, canvas, pointAt } = harness();
    drawTool.activate();
    pointAt(10, 10);
    expect(canvas.focus).toHaveBeenCalledTimes(1);
  });
});
