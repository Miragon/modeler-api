import { describe, expect, it } from "vitest";
import {
  FIT_ANIMATION_MS,
  MAX_FIT_ZOOM,
  VIEW_TOLERANCE,
  easeStandard,
  fitInsets,
  fitViewbox,
  interpolateViewbox,
  sameView,
  type FitLayout,
} from "./fit.js";
import type { Bounds, Insets, Point, ScaledViewbox, Size } from "./types.js";

const IDE_INSETS: Insets = { top: 88, right: 24, bottom: 64, left: 24 };
const CONTAINER: Size = { width: 1000, height: 800 };

function toScreen(point: Point, box: ScaledViewbox): Point {
  return { x: (point.x - box.x) * box.scale, y: (point.y - box.y) * box.scale };
}

function fitted(bounds: Bounds, container = CONTAINER, insets = IDE_INSETS, maxZoom?: number): ScaledViewbox {
  const box = fitViewbox(bounds, container, insets, maxZoom);
  if (!box) throw new Error("expected a viewbox");
  return box;
}

/** What diagram-js's `canvas.viewbox(box)` setter applies: scale from the box, `box.x/y` top-left. */
function diagramJsScale(box: Bounds, container: Size): number {
  return Math.min(container.width / box.width, container.height / box.height);
}

/** diagram-js's `canvas.viewbox()` getter: scale and screen translation rounded to 1/1000. */
function diagramJsRead(
  set: Pick<ScaledViewbox, "x" | "y" | "scale">,
): Pick<ScaledViewbox, "x" | "y" | "scale"> {
  const round = (value: number) => Math.round(value * 1000) / 1000;
  const scale = round(set.scale);
  const x = round(set.x * set.scale);
  const y = round(set.y * set.scale);
  return { x: x ? x / scale : 0, y: y ? y / scale : 0, scale };
}

describe("constants", () => {
  it("match guide §5.9 and §5.14", () => {
    expect(MAX_FIT_ZOOM).toBe(1);
    expect(FIT_ANIMATION_MS).toBe(250);
    expect(VIEW_TOLERANCE).toBe(1e-3);
  });
});

describe("fitViewbox", () => {
  it("centres the content in the free rectangle, not in the container", () => {
    const bounds = { x: 100, y: 50, width: 200, height: 100 };
    const box = fitted(bounds);
    const centre = toScreen({ x: 200, y: 100 }, box);
    expect(centre.x).toBeCloseTo(24 + (1000 - 48) / 2);
    expect(centre.y).toBeCloseTo(88 + (800 - 88 - 64) / 2);
  });

  it("never zooms above 100 %", () => {
    const box = fitted({ x: 0, y: 0, width: 10, height: 10 });
    expect(box.scale).toBe(1);
    expect(box.width).toBe(1000);
    expect(box.height).toBe(800);
  });

  it("honours another maxZoom", () => {
    expect(fitted({ x: 0, y: 0, width: 100, height: 100 }, CONTAINER, IDE_INSETS, 2).scale).toBe(2);
  });

  it("fits large content exactly into the free rectangle on its limiting axis", () => {
    const bounds = { x: -500, y: 300, width: 2000, height: 500 };
    const box = fitted(bounds);
    expect(box.scale).toBeCloseTo(952 / 2000);
    expect(toScreen({ x: -500, y: 300 }, box).x).toBeCloseTo(24);
    expect(toScreen({ x: 1500, y: 800 }, box).x).toBeCloseTo(976);
    const top = toScreen({ x: 0, y: 300 }, box).y;
    const bottom = toScreen({ x: 0, y: 800 }, box).y;
    expect(top).toBeGreaterThan(88);
    expect(bottom).toBeLessThan(736);
    expect((top + bottom) / 2).toBeCloseTo(412);
  });

  it("goes below 20 % for huge content (there is no lower limit)", () => {
    expect(fitted({ x: 0, y: 0, width: 20000, height: 100 }).scale).toBeCloseTo(952 / 20000);
  });

  it("keeps the container's aspect ratio, so diagram-js applies exactly the computed scale", () => {
    for (const container of [CONTAINER, { width: 420, height: 700 }, { width: 1920, height: 300 }]) {
      const box = fitted({ x: 10, y: 20, width: 300, height: 900 }, container);
      expect(box.width / box.height).toBeCloseTo(container.width / container.height);
      expect(box.width * box.scale).toBeCloseTo(container.width);
      expect(diagramJsScale(box, container)).toBeCloseTo(box.scale, 12);
    }
  });

  it("scales a zero-width content by its height and centres it horizontally", () => {
    const box = fitted({ x: 300, y: 0, width: 0, height: 1296 });
    expect(box.scale).toBeCloseTo(648 / 1296);
    expect(toScreen({ x: 300, y: 648 }, box).x).toBeCloseTo(500);
    expect(toScreen({ x: 300, y: 648 }, box).y).toBeCloseTo(412);
  });

  it("scales a zero-height content by its width", () => {
    const box = fitted({ x: 0, y: 40, width: 1904, height: 0 });
    expect(box.scale).toBeCloseTo(952 / 1904);
    expect(toScreen({ x: 952, y: 40 }, box)).toEqual({ x: expect.closeTo(500), y: expect.closeTo(412) });
  });

  it("returns undefined for content without width and height", () => {
    expect(fitViewbox({ x: 5, y: 5, width: 0, height: 0 }, CONTAINER, IDE_INSETS)).toBeUndefined();
    expect(fitViewbox({ x: 5, y: 5, width: Number.NaN, height: 0 }, CONTAINER, IDE_INSETS)).toBeUndefined();
  });

  it("returns undefined for a 0 × 0 container (a hidden tab)", () => {
    const bounds = { x: 0, y: 0, width: 100, height: 100 };
    expect(fitViewbox(bounds, { width: 0, height: 0 }, IDE_INSETS)).toBeUndefined();
    expect(fitViewbox(bounds, { width: 0, height: 500 }, IDE_INSETS)).toBeUndefined();
    expect(fitViewbox(bounds, { width: 500, height: 0 }, IDE_INSETS)).toBeUndefined();
  });

  it("centres in the whole container on an axis the insets leave no room on", () => {
    const box = fitted({ x: 0, y: 0, width: 100, height: 280 }, { width: 600, height: 140 });
    expect(box.scale).toBeCloseTo(0.5);
    expect(toScreen({ x: 50, y: 140 }, box)).toEqual({ x: expect.closeTo(300), y: expect.closeTo(70) });
  });
});

describe("fitInsets (guide §5.9)", () => {
  const layout = (overrides: Partial<FitLayout> = {}): FitLayout => ({
    container: { width: 1280, height: 900 },
    host: "ide",
    paletteRow: "top",
    problemsVisible: false,
    ...overrides,
  });

  it("top 88, sides 24, bottom 64", () => {
    expect(fitInsets(layout())).toEqual({ top: 88, right: 24, bottom: 64, left: 24 });
  });

  it("top 140 with the palette in the second row", () => {
    expect(fitInsets(layout({ paletteRow: "second-row" })).top).toBe(140);
  });

  it("bottom 92 only in the web app with a visible pill", () => {
    expect(fitInsets(layout({ host: "web", problemsVisible: true })).bottom).toBe(92);
    expect(fitInsets(layout({ host: "web", problemsVisible: false })).bottom).toBe(64);
    expect(fitInsets(layout({ host: "ide", problemsVisible: true })).bottom).toBe(64);
    expect(fitInsets(layout({ host: "embedded", problemsVisible: true })).bottom).toBe(64);
  });

  it("right 324 (12 + 288 + 24) with an open side inspector in containers wider than 760", () => {
    expect(fitInsets(layout({ container: { width: 761, height: 900 }, inspector: {} }))).toEqual({
      top: 88,
      right: 324,
      bottom: 64,
      left: 24,
    });
  });

  it("left 12 + legend width + 24 with an open legend in containers wider than 440 only", () => {
    expect(fitInsets(layout({ legendWidth: 200 })).left).toBe(236);
    expect(fitInsets(layout({ container: { width: 441, height: 700 }, legendWidth: 184.5 })).left).toBe(
      220.5,
    );
    expect(fitInsets(layout({ container: { width: 440, height: 700 }, legendWidth: 200 })).left).toBe(24);
    expect(fitInsets(layout({ legendWidth: 0 })).left).toBe(24);
  });

  it("counts legend and side inspector together", () => {
    expect(fitInsets(layout({ legendWidth: 200, inspector: {} }))).toEqual({
      top: 88,
      right: 324,
      bottom: 64,
      left: 236,
    });
  });

  it("bottom = container height − sheet top + 12 with an open bottom sheet up to 760", () => {
    const insets = fitInsets(
      layout({ container: { width: 760, height: 700 }, inspector: { sheetTop: 400 } }),
    );
    expect(insets).toEqual({ top: 88, right: 24, bottom: 312, left: 24 });
  });

  it("drops pill and legend while the bottom sheet hides them (guide §5.11)", () => {
    const insets = fitInsets(
      layout({
        container: { width: 600, height: 700 },
        host: "web",
        problemsVisible: true,
        legendWidth: 200,
        paletteRow: "second-row",
        inspector: { sheetTop: 450 },
      }),
    );
    expect(insets).toEqual({ top: 140, right: 24, bottom: 262, left: 24 });
  });

  it("keeps the default bottom while the sheet's top edge is not measured yet", () => {
    expect(fitInsets(layout({ container: { width: 600, height: 700 }, inspector: {} })).bottom).toBe(64);
  });
});

describe("sameView", () => {
  const view = { x: 120.5, y: -40.25, scale: 0.86 };

  it("is true for the same view and false for a pan or a zoom", () => {
    expect(sameView(view, { ...view })).toBe(true);
    expect(sameView(view, { ...view, x: view.x + 1 / view.scale })).toBe(false);
    expect(sameView(view, { ...view, y: view.y - 2 })).toBe(false);
    expect(sameView(view, { ...view, scale: view.scale * 1.349 })).toBe(false);
  });

  it("absorbs diagram-js's rounding of the transform, also at small zoom near the origin", () => {
    const views = [
      { x: 0.3141, y: -0.2718, scale: 0.2004 },
      { x: 2.4, y: -1.7, scale: 0.2004 },
      { x: 0.0004, y: 0.0007, scale: 0.2 },
      { x: -2.5, y: 1.25, scale: 0.2236 },
      { x: 12345.678, y: -9876.543, scale: 0.2001 },
      { x: -812.3456, y: 433.21, scale: 3.9996 },
      { x: 0, y: 0, scale: 1 },
    ];
    for (const set of views) expect(sameView(diagramJsRead(set), set)).toBe(true);
  });

  it("needs the screen translation: diagram coordinates near the origin miss the tolerance", () => {
    const set = { x: 2.4, y: -1.7, scale: 0.2004 };
    const read = diagramJsRead(set);
    expect(Math.abs(read.x - set.x)).toBeGreaterThan(VIEW_TOLERANCE * Math.max(1, Math.abs(set.x)));
    expect(Math.abs(read.y - set.y)).toBeGreaterThan(VIEW_TOLERANCE * Math.max(1, Math.abs(set.y)));
    expect(sameView(read, set)).toBe(true);
  });

  it("still sees a one-pixel pan at small zoom near the origin", () => {
    const set = { x: 2.4, y: -1.7, scale: 0.2004 };
    expect(sameView(diagramJsRead({ ...set, x: set.x + 1 / set.scale }), set)).toBe(false);
  });

  it("ignores width and height, so a resize is no move", () => {
    const before = { ...view, width: 1000 / view.scale, height: 800 / view.scale };
    const after = { ...view, width: 600 / view.scale, height: 900 / view.scale };
    expect(sameView(before, after)).toBe(true);
  });

  it("takes another tolerance", () => {
    expect(sameView(view, { ...view, x: view.x + 0.5 }, 1)).toBe(true);
    expect(sameView(view, { ...view, x: view.x + 0.5 }, 0)).toBe(false);
  });
});

describe("interpolateViewbox", () => {
  const container = { width: 1000, height: 800 };
  const box = (x: number, y: number, scale: number): ScaledViewbox => ({
    x,
    y,
    width: container.width / scale,
    height: container.height / scale,
    scale,
  });
  const from = box(-200, -100, 0.5);
  const to = box(300, 250, 2);

  it("returns the endpoints at 0 and 1, and clamps beyond", () => {
    expect(interpolateViewbox(from, to, 0)).toEqual(from);
    expect(interpolateViewbox(from, to, 1)).toEqual(to);
    expect(interpolateViewbox(from, to, -0.5)).toEqual(from);
    expect(interpolateViewbox(from, to, 1.5)).toEqual(to);
    expect(interpolateViewbox(from, to, 0)).not.toBe(from);
  });

  it("interpolates the scale in log space and the centre linearly", () => {
    const middle = interpolateViewbox(from, to, 0.5);
    expect(middle.scale).toBeCloseTo(Math.sqrt(0.5 * 2));
    const centre = (b: ScaledViewbox) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
    expect(centre(middle).x).toBeCloseTo((centre(from).x + centre(to).x) / 2);
    expect(centre(middle).y).toBeCloseTo((centre(from).y + centre(to).y) / 2);
    expect(interpolateViewbox(from, to, 0.25).scale).toBeCloseTo(0.5 * 4 ** 0.25);
  });

  it("keeps the container size on every frame", () => {
    for (const progress of [0.1, 0.33, 0.5, 0.9]) {
      const frame = interpolateViewbox(from, to, progress);
      expect(frame.width * frame.scale).toBeCloseTo(container.width);
      expect(frame.height * frame.scale).toBeCloseTo(container.height);
    }
  });
});

describe("easeStandard", () => {
  it("starts at 0 and ends at 1, clamped outside", () => {
    expect(easeStandard(0)).toBe(0);
    expect(easeStandard(1)).toBe(1);
    expect(easeStandard(-1)).toBe(0);
    expect(easeStandard(2)).toBe(1);
    expect(easeStandard(Number.NaN)).toBe(0);
  });

  it("is monotone", () => {
    let previous = 0;
    for (let step = 1; step <= 1000; step++) {
      const value = easeStandard(step / 1000);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it("follows cubic-bezier(0.4, 0, 0.2, 1)", () => {
    expect(easeStandard(0.1)).toBeCloseTo(0.025863, 5);
    expect(easeStandard(0.25)).toBeCloseTo(0.236587, 5);
    expect(easeStandard(0.5)).toBeCloseTo(0.775561, 5);
    expect(easeStandard(0.75)).toBeCloseTo(0.959368, 5);
    expect(easeStandard(0.9)).toBeCloseTo(0.994354, 5);
  });
});
