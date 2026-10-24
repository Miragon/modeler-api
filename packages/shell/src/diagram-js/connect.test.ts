import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { fitViewbox, SHELL, type Bounds } from "../core/index.js";
import { FakeCanvas, FakeEventBus } from "../../test/support/diagram-js.js";
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

beforeEach(installFakes);
afterEach(cleanup);

function connected(legendOpen: boolean) {
  const { shell } = mount({ legend: { render() {}, open: legendOpen } });
  const legend = shell.legend;
  if (!legend) throw new Error("no legend");
  const setLegendWidth = (width: number) =>
    setBox(legend.element, { left: SHELL.edge, top: 500, width, height: 240 });
  setLegendWidth(FALLBACK_WIDTH);
  const bus = new FakeEventBus();
  const canvas = new FakeCanvas(bus);
  const services: Record<string, unknown> = {
    canvas,
    eventBus: bus,
    modelerShell: { attachShell: () => () => undefined },
  };
  const diagram = { get: <T>(name: string) => services[name] as T };
  const connection = connectDiagramJs(shell, diagram, { contentBounds: () => CONTENT });
  const watches = () =>
    FakeResizeObserver.instances.some((observer) => observer.observed.has(legend.element));
  /** The card changes its size; the observer reports it. */
  const settle = (width: number) => {
    setLegendWidth(width);
    FakeResizeObserver.resize(legend.element);
  };
  return { shell, legend, canvas, connection, watches, settle };
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
  it("fits once more with the settled width, then stops watching", () => {
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
    const { canvas, connection, watches, settle } = connected(true);
    settle(SETTLED_WIDTH);
    expect(canvas.viewboxWrites).toEqual([]);
    connection.viewport.afterImport();
    settle(SETTLED_WIDTH);
    expect(canvas.viewboxWrites).toEqual([fitWithLegend(canvas, SETTLED_WIDTH)]);
    expect(watches()).toBe(true);
  });

  it("keeps a view the user zoomed since the fit, and stops watching", () => {
    const { canvas, connection, watches, settle } = connected(true);
    connection.viewport.afterImport();
    connection.viewport.stepZoom(-1);
    expect(watches()).toBe(false);
    const writes = canvas.viewboxWrites.length;
    settle(SETTLED_WIDTH);
    expect(canvas.viewboxWrites).toHaveLength(writes);
  });

  it("keeps a view the user panned since the fit, and stops watching", () => {
    const { canvas, connection, watches, settle } = connected(true);
    connection.viewport.afterImport();
    canvas.pan(40, 0);
    expect(watches()).toBe(false);
    settle(SETTLED_WIDTH);
    expect(canvas.viewboxWrites).toHaveLength(1);
  });

  it("does not watch a legend that starts closed: opening it never fits (guide §5.9)", () => {
    const { legend, canvas, connection, watches, settle } = connected(false);
    expect(watches()).toBe(false);
    connection.viewport.afterImport();
    legend.setOpen(true);
    settle(SETTLED_WIDTH);
    expect(canvas.viewboxWrites).toEqual([fitWithLegend(canvas, undefined)]);
  });

  it("stops watching when the legend closes, so reopening it never fits (guide §5.9)", () => {
    const { legend, canvas, connection, watches, settle } = connected(true);
    connection.viewport.afterImport();
    legend.setOpen(false);
    settle(0);
    expect(watches()).toBe(false);
    legend.setOpen(true);
    settle(SETTLED_WIDTH);
    expect(canvas.viewboxWrites).toHaveLength(1);
  });

  it("stops watching with the connection", () => {
    const { canvas, connection, watches, settle } = connected(true);
    connection.viewport.afterImport();
    connection.destroy();
    expect(watches()).toBe(false);
    settle(SETTLED_WIDTH);
    expect(canvas.viewboxWrites).toHaveLength(1);
  });
});
