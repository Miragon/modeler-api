import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import type ContextPad from "diagram-js/lib/features/context-pad/ContextPad";
import type ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import type Selection from "diagram-js/lib/features/selection/Selection";
import type { Element } from "diagram-js/lib/model/Types";
import { Modeler } from "../../src/index.js";
import type EventStormingDrawTool from "../../src/draw-tool/EventStormingDrawTool.js";
import { isEventStormingShape, type EventStormingShape } from "../../src/model/di-types.js";
import "../../src/assets/event-storming.css";

const DSL = `title Keyboard Fixture
command Place Order [300, 300]
event Order Placed [600, 300]
line [[200, 500], [400, 560], [600, 500]]`;

/**
 * Issue #91: the board's keys act only while the canvas itself has the focus, as diagram-js 15
 * binds its keyboard. These cases run without a shell around the canvas, as an embedding host does,
 * so the renderer alone has to hand the focus back after a pointer click on its own controls.
 */
describe("Event Storming keys act only on the focused canvas (no shell)", () => {
  let container: HTMLElement;
  let pageText: HTMLElement;
  let hostField: HTMLInputElement;
  let modeler: Modeler;

  beforeEach(async () => {
    await page.viewport(1280, 1024);
    pageText = document.createElement("p");
    pageText.textContent = "Some page text next to the board.";
    hostField = document.createElement("input");
    hostField.setAttribute("aria-label", "Host field");
    container = document.createElement("div");
    document.body.append(pageText, hostField, container);
    modeler = new Modeler({ container, width: 1024, height: 768, fitOnImport: false });
    await modeler.importDSL(DSL);
  });

  afterEach(async () => {
    // Off the palette first: its hover tooltip would otherwise show on the destroyed diagram.
    await userEvent.hover(pageText);
    modeler.destroy();
    container.remove();
    pageText.remove();
    hostField.remove();
  });

  const svg = () => container.querySelector<SVGSVGElement>(".djs-container > svg")!;
  const canvasHasFocus = () => document.activeElement === svg();
  const shapes = () =>
    modeler
      .get<ElementRegistry>("elementRegistry")
      .filter((element) => isEventStormingShape(element)) as EventStormingShape[];
  const shapeLabelled = (label: string) =>
    shapes().find((shape) => shape.eventStormingLabel === label)!;
  const drawing = () => shapes().find((shape) => shape.eventStormingType === "drawing")!;
  const gfx = (shape: EventStormingShape) =>
    modeler.get<ElementRegistry>("elementRegistry").getGraphics(shape) as unknown as SVGElement;
  const select = (shape: EventStormingShape) =>
    modeler.get<Selection>("selection").select(shape as unknown as Element);
  const drawTool = () => modeler.get<EventStormingDrawTool>("eventStormingDrawTool");
  const paletteEntry = (action: string) =>
    container.querySelector<HTMLElement>(`.djs-palette .entry[data-action="${action}"]`)!;
  const padEntry = (action: string) =>
    container.querySelector<HTMLElement>(`.djs-context-pad .entry[data-action="${action}"]`)!;
  const nextTask = () => new Promise((resolve) => setTimeout(resolve, 20));

  it("deletes the selection with the canvas focused, and not after a click on page text", async () => {
    const before = shapes().length;
    await userEvent.click(gfx(shapeLabelled("Place Order")));
    expect(canvasHasFocus()).toBe(true);
    await userEvent.keyboard("{Delete}");
    expect(shapes()).toHaveLength(before - 1);

    modeler.undo();
    await userEvent.click(pageText);
    expect(document.activeElement).toBe(document.body);
    select(shapeLabelled("Place Order"));
    await userEvent.keyboard("{Backspace}");
    expect(shapes()).toHaveLength(before);
    // The undone delete waits on the stack: redo from the page must not bring it back.
    await userEvent.keyboard("{Control>}{Shift>}z{/Shift}{/Control}");
    expect(shapes()).toHaveLength(before);
  });

  // The pause a host needs while it shows something else: hiding the canvas makes it inert.
  it("leaves a canvas the host hid alone", async () => {
    const before = shapes().length;
    select(shapeLabelled("Place Order"));
    svg().focus();
    container.inert = true;
    await userEvent.keyboard("{Backspace}");
    container.inert = false;
    container.style.display = "none";
    await userEvent.keyboard("{Delete}");
    expect(shapes()).toHaveLength(before);
  });

  it("hands the focus to the canvas after a pointer click on a palette tool", async () => {
    await userEvent.click(paletteEntry("lasso-tool"));
    expect(canvasHasFocus()).toBe(true);
    await userEvent.keyboard("{Escape}");

    const before = shapes().length;
    select(shapeLabelled("Order Placed"));
    await userEvent.keyboard("{Delete}");
    expect(shapes()).toHaveLength(before - 1);
  });

  it("cancels the draw tool with Escape after a pointer click on its entry", async () => {
    await userEvent.click(paletteEntry("draw-tool"));
    expect(drawTool().isActive()).toBe(true);
    expect(canvasHasFocus()).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(drawTool().isActive()).toBe(false);
  });

  it("focuses the canvas on the first point and leaves a host field its Enter and Escape", async () => {
    const before = shapes().length;
    drawTool().activate();
    hostField.focus();
    await userEvent.click(svg(), { position: { x: 700, y: 520 } });
    expect(canvasHasFocus()).toBe(true);
    await userEvent.click(svg(), { position: { x: 800, y: 580 } });

    hostField.focus();
    await userEvent.keyboard("{Escape}{Enter}");
    expect(drawTool().isActive()).toBe(true);
    expect(shapes()).toHaveLength(before);

    await userEvent.click(svg(), { position: { x: 900, y: 520 } });
    await userEvent.keyboard("{Enter}");
    expect(drawTool().isActive()).toBe(false);
    expect(shapes()).toHaveLength(before + 1);
  });

  it("hands the focus to the canvas after the context pad's delete, so undo follows", async () => {
    const before = shapes().length;
    await userEvent.click(gfx(shapeLabelled("Place Order")));
    await userEvent.click(padEntry("delete"));
    expect(shapes()).toHaveLength(before - 1);
    expect(canvasHasFocus()).toBe(true);
    await userEvent.keyboard("{Control>}z{/Control}");
    expect(shapes()).toHaveLength(before);
  });

  it("hands the focus to the canvas once the context pad's connect starts", async () => {
    await userEvent.click(gfx(shapeLabelled("Place Order")));
    await userEvent.click(padEntry("connect"));
    expect(canvasHasFocus()).toBe(true);
    await userEvent.keyboard("{Escape}");
  });

  it("hands the focus back to the canvas once a colour is picked", async () => {
    select(drawing());
    modeler.get<ContextPad>("contextPad").open(drawing() as unknown as Element);
    await userEvent.click(padEntry("color"));
    await nextTask();
    const swatch = container.querySelector<HTMLElement>(".event-storming-cp-swatch:nth-child(2)")!;
    await userEvent.click(swatch);
    await nextTask();
    expect(drawing().color).toBeDefined();
    expect(canvasHasFocus()).toBe(true);
  });
});
