import { describe, expect, it } from "vitest";

import type { ChromeIsland, PaletteRow, Size } from "../core/index.js";
import {
  GEOMETRY_TOLERANCE_PX,
  ZOOM_PANEL_WIDTH,
  boxMismatches,
  chromeExpectations,
  dropdownProblems,
  expectedChromeBoxes,
  expectedFitInsets,
  freeRectangle,
  geometryProblems,
  limitViolations,
  tooltipProblems,
  type ChromeMeasurement,
  type IslandBox,
} from "./geometry.js";

const WIDE: Size = { width: 1280, height: 900 };
const NARROW: Size = { width: 720, height: 700 };
const VERY_NARROW: Size = { width: 420, height: 700 };

/** A box from its anchor edges, the way the CSS places islands. */
function anchored(
  container: Size,
  size: { width: number; height: number },
  anchor: { left?: number; right?: number; top?: number; bottom?: number; centerX?: number },
): IslandBox {
  const left =
    anchor.left ??
    (anchor.right !== undefined
      ? container.width - anchor.right - size.width
      : (anchor.centerX ?? container.width / 2) - size.width / 2);
  const top = anchor.top ?? container.height - (anchor.bottom ?? 0) - size.height;
  return { left, top, width: size.width, height: size.height };
}

interface Layout {
  container?: Size;
  paletteRow?: PaletteRow;
  open?: Partial<ChromeMeasurement["open"]>;
  islands?: Partial<Record<ChromeIsland, IslandBox>>;
}

/** A conforming IDE measurement: menu, palette, zoom panel at their anchors. */
function measurement({
  container = WIDE,
  paletteRow,
  open = {},
  islands = {},
}: Layout = {}): ChromeMeasurement {
  const row = paletteRow ?? (container.width <= 760 ? "second-row" : "top");
  return {
    container,
    paletteRow: row,
    open: { legend: false, inspector: false, problems: false, ...open },
    islands: {
      menu: { left: 12, top: 12, width: 40, height: 40 },
      palette: anchored(container, { width: 160, height: 40 }, { top: row === "top" ? 12 : 64 }),
      zoom: anchored(container, { width: 173, height: 40 }, { right: 12, bottom: 12 }),
      ...islands,
    },
  };
}

describe("expectedChromeBoxes", () => {
  it("anchors menu, palette and zoom panel in a wide IDE container", () => {
    expect(expectedChromeBoxes(measurement(), "ide")).toEqual({
      menu: { left: 12, top: 12, width: 40, height: 40 },
      palette: { top: 12, height: 40, centerX: 640 },
      zoom: { right: 12, bottom: 12, width: ZOOM_PANEL_WIDTH, height: 40 },
    });
  });

  it("puts the palette in the second row at top 64 and the status box at top 116", () => {
    const status = anchored(NARROW, { width: 400, height: 48 }, { top: 116 });
    const boxes = expectedChromeBoxes(measurement({ container: NARROW, islands: { status } }), "ide");
    expect(boxes.palette).toEqual({ top: 64, height: 40, centerX: 360 });
    expect(boxes.status).toEqual({ top: 116, centerX: 360 });
  });

  it("puts the status box at top 64 under a top-row palette", () => {
    const status = anchored(WIDE, { width: 400, height: 48 }, { top: 64 });
    expect(expectedChromeBoxes(measurement({ islands: { status } }), "ide").status).toEqual({
      top: 64,
      centerX: 640,
    });
  });

  it.each([
    ["ide", false, 12, 12],
    ["ide", true, 12, 60],
    ["embedded", true, 12, 60],
    ["web", false, 40, 40],
    ["web", true, 40, 88],
  ] as const)(
    "stacks pill and legend bottom-left (%s host, pill %s)",
    (host, pill, pillBottom, legendBottom) => {
      const islands: Partial<Record<ChromeIsland, IslandBox>> = {
        legend: anchored(WIDE, { width: 200, height: 120 }, { left: 12, bottom: legendBottom }),
      };
      if (pill)
        islands.problems = anchored(WIDE, { width: 120, height: 40 }, { left: 12, bottom: pillBottom });
      const boxes = expectedChromeBoxes(
        measurement({ islands, open: { legend: true, problems: pill } }),
        host,
      );
      expect(boxes.legend).toEqual({ left: 12, bottom: legendBottom });
      if (pill) expect(boxes.problems).toEqual({ left: 12, bottom: pillBottom, height: 40 });
      else expect(boxes.problems).toBeUndefined();
    },
  );

  it.each([
    ["ide", false, 60],
    ["ide", true, 60],
    ["web", false, 60],
    ["web", true, 88],
  ] as const)(
    "lifts the legend above the bottom row up to 440px (%s host, pill %s)",
    (host, pill, bottom) => {
      const islands: Partial<Record<ChromeIsland, IslandBox>> = {
        legend: anchored(VERY_NARROW, { width: 200, height: 120 }, { left: 12, bottom }),
      };
      if (pill) {
        islands.problems = anchored(
          VERY_NARROW,
          { width: 120, height: 40 },
          {
            left: 12,
            bottom: host === "web" ? 40 : 12,
          },
        );
      }
      const boxes = expectedChromeBoxes(
        measurement({ container: VERY_NARROW, islands, open: { legend: true, problems: pill } }),
        host,
      );
      expect(boxes.legend).toEqual({ left: 12, bottom });
    },
  );

  it("docks an open inspector on the right above 760px and centres the status box left of it", () => {
    const inspector = anchored(WIDE, { width: 288, height: 300 }, { top: 64, right: 12 });
    const status = anchored(WIDE, { width: 400, height: 48 }, { top: 64, centerX: 490 });
    const boxes = expectedChromeBoxes(
      measurement({ islands: { inspector, status }, open: { inspector: true } }),
      "ide",
    );
    expect(boxes.inspector).toEqual({ top: 64, right: 12, width: 288 });
    expect(boxes.status).toEqual({ top: 64, centerX: 490 });
  });

  it("turns the inspector into a bottom sheet up to 760px and hides zoom, pill and legend", () => {
    const inspector = anchored(NARROW, { width: 696, height: 200 }, { left: 12, bottom: 12 });
    const state = measurement({
      container: NARROW,
      islands: { inspector },
      open: { inspector: true, legend: true, problems: true },
    });
    const expectations = chromeExpectations(state, "ide");
    expect(expectations.boxes.inspector).toEqual({ left: 12, right: 12, bottom: 12 });
    expect(expectations.boxes.zoom).toBeUndefined();
    expect(expectations.required).toEqual(["menu", "palette"]);
    expect(Object.keys(expectations.hidden)).toEqual(expect.arrayContaining(["zoom", "problems", "legend"]));
    expect(expectations.boxes.status).toBeUndefined();
  });

  it("anchors a web app's primary action top right and keeps that corner empty elsewhere", () => {
    const primary = anchored(WIDE, { width: 96, height: 40 }, { top: 12, right: 12 });
    expect(expectedChromeBoxes(measurement({ islands: { primary } }), "web").primary).toEqual({
      top: 12,
      right: 12,
      height: 40,
    });
    expect(expectedChromeBoxes(measurement({ islands: { primary } }), "ide").primary).toBeUndefined();
  });
});

describe("tolerance", () => {
  const box: IslandBox = { left: 1095, top: 848, width: 173, height: 40 };

  it("is 1px", () => {
    expect(GEOMETRY_TOLERANCE_PX).toBe(1);
  });

  it("accepts a box exactly 1px off and rejects one 1.5px or 2px off", () => {
    const expected = { right: 12, bottom: 12, width: 173, height: 40 };
    expect(boxMismatches("zoom", { ...box, left: box.left + 1 }, expected, WIDE)).toEqual([]);
    expect(boxMismatches("zoom", { ...box, left: box.left + 1.5 }, expected, WIDE)).toEqual([
      "zoom: right is 10.5px, expected 12px (±1px)",
    ]);
    expect(boxMismatches("zoom", { ...box, top: box.top - 2 }, expected, WIDE)).toEqual([
      "zoom: bottom is 14px, expected 12px (±1px)",
    ]);
  });

  it("checks the horizontal centre", () => {
    const palette = { left: 562, top: 12, width: 160, height: 40 };
    expect(boxMismatches("palette", palette, { centerX: 640 }, WIDE)).toEqual([
      "palette: centerX is 642px, expected 640px (±1px)",
    ]);
  });

  it("applies the tolerance to limits as well", () => {
    const legend = { left: 12, top: 700, width: 183, height: 100 };
    expect(limitViolations("legend", legend, { minWidth: 184 }, WIDE)).toEqual([]);
    expect(limitViolations("legend", { ...legend, width: 182.5 }, { minWidth: 184 }, WIDE)).toEqual([
      "legend: width is 182.5px, at least 184px expected",
    ]);
  });
});

describe("geometryProblems", () => {
  it("passes conforming layouts in every breakpoint", () => {
    expect(geometryProblems(measurement(), "ide")).toEqual([]);
    expect(geometryProblems(measurement({ container: NARROW }), "ide")).toEqual([]);
    expect(geometryProblems(measurement({ container: VERY_NARROW }), "embedded")).toEqual([]);
  });

  it("reports a missing required island", () => {
    const state = measurement();
    delete state.islands.zoom;
    expect(geometryProblems(state, "ide")).toEqual(['zoom: [data-chrome="zoom"] is missing or not visible']);
  });

  it("reports an island shifted by 2px", () => {
    const state = measurement();
    state.islands.zoom = { ...state.islands.zoom!, left: state.islands.zoom!.left + 2 };
    expect(geometryProblems(state, "ide")).toEqual(["zoom: right is 10px, expected 12px (±1px)"]);
  });

  it("requires the second row up to 760px", () => {
    const state = measurement({ container: NARROW, paletteRow: "top" });
    expect(geometryProblems(state, "ide")).toContain(
      'palette: data-palette="top" in a 720px wide container; up to 760px it is "second-row" (guide §5.15)',
    );
  });

  it("rejects the second row above 760px when the palette fits the top row", () => {
    const state = measurement({ paletteRow: "second-row" });
    expect(geometryProblems(state, "ide")).toEqual([
      "palette: in the second row although the top row keeps 508px to the menu trigger (at least 16px suffice, guide §5.15)",
    ]);
  });

  it("accepts the second row above 760px for a palette too wide for the top row", () => {
    const container = { width: 900, height: 900 };
    const state = measurement({
      container,
      paletteRow: "second-row",
      islands: { palette: { left: 12, top: 64, width: 876, height: 40 } },
    });
    expect(geometryProblems(state, "ide")).toEqual([]);
  });

  it("keeps 16px between the menu trigger and a top-row palette", () => {
    const container = { width: 800, height: 900 };
    const state = measurement({
      container,
      islands: { palette: anchored(container, { width: 680, height: 40 }, { top: 12 }) },
    });
    expect(geometryProblems(state, "ide")).toEqual(["palette: left is 60px, at least 68px expected"]);
  });

  it("caps the second-row palette at the container width minus 24px", () => {
    const state = measurement({
      container: VERY_NARROW,
      islands: { palette: { left: 4, top: 64, width: 412, height: 40 } },
    });
    expect(geometryProblems(state, "ide")).toEqual(["palette: width is 412px, at most 396px expected"]);
  });

  it("keeps the top right empty outside the web app", () => {
    const primary = anchored(WIDE, { width: 96, height: 40 }, { top: 12, right: 12 });
    expect(geometryProblems(measurement({ islands: { primary } }), "ide")).toEqual([
      "primary: visible, but the top right stays empty in IDE and embedded hosts (guide §5.7)",
    ]);
  });

  it("reports zoom, pill and legend left visible under an open bottom sheet", () => {
    const inspector = anchored(NARROW, { width: 696, height: 200 }, { left: 12, bottom: 12 });
    const state = measurement({ container: NARROW, islands: { inspector }, open: { inspector: true } });
    expect(geometryProblems(state, "ide")).toEqual([
      "zoom: visible, but hidden while the inspector is a bottom sheet (guide §5.11)",
    ]);
  });

  it("limits the bottom sheet to 45% of the container height", () => {
    const inspector = anchored(NARROW, { width: 696, height: 400 }, { left: 12, bottom: 12 });
    const state = measurement({ container: NARROW, islands: { inspector }, open: { inspector: true } });
    delete state.islands.zoom;
    expect(geometryProblems(state, "ide")).toEqual(["inspector: height is 400px, at most 315px expected"]);
  });

  it("keeps the side inspector 64px above the bottom", () => {
    const inspector = anchored(WIDE, { width: 288, height: 800 }, { top: 64, right: 12 });
    const state = measurement({ islands: { inspector }, open: { inspector: true } });
    expect(geometryProblems(state, "ide")).toEqual(["inspector: bottom is 36px, at least 64px expected"]);
  });

  it("checks the root's state attributes against what is visible", () => {
    const pill = anchored(WIDE, { width: 120, height: 40 }, { left: 12, bottom: 12 });
    expect(geometryProblems(measurement({ open: { problems: true } }), "ide")).toEqual([
      'problems: the root carries data-problems="shown", but the island is not visible',
    ]);
    expect(geometryProblems(measurement({ islands: { problems: pill } }), "ide")).toEqual([
      'problems: visible, but the root lacks data-problems="shown"',
    ]);
  });

  it("requires the legend to be at least 184px wide", () => {
    const legend = anchored(WIDE, { width: 150, height: 100 }, { left: 12, bottom: 12 });
    expect(geometryProblems(measurement({ islands: { legend }, open: { legend: true } }), "ide")).toEqual([
      "legend: width is 150px, at least 184px expected",
    ]);
  });
});

describe("dropdownProblems", () => {
  it("opens 8px under the trigger, at least 248px wide", () => {
    expect(dropdownProblems({ left: 12, top: 60, width: 248, height: 300 }, WIDE)).toEqual([]);
    expect(dropdownProblems({ left: 12, top: 62, width: 200, height: 300 }, WIDE)).toEqual([
      "dropdown: top is 62px, expected 60px (±1px)",
      "dropdown: width is 200px, at least 248px expected",
    ]);
  });

  it("stays 12px above the bottom and within min(320px, 100% − 24px)", () => {
    expect(dropdownProblems({ left: 12, top: 60, width: 330, height: 640 }, NARROW)).toEqual([
      "dropdown: width is 330px, at most 320px expected",
      "dropdown: bottom is 0px, at least 12px expected",
    ]);
  });
});

describe("tooltipProblems", () => {
  const menu = { left: 12, top: 12, width: 40, height: 40 };

  it("stands under the top row at 60px, shifted to keep 12px to the side", () => {
    expect(tooltipProblems({ left: 12, top: 60, width: 60, height: 28 }, menu, "top", WIDE)).toEqual([]);
    expect(tooltipProblems({ left: 2, top: 60, width: 60, height: 28 }, menu, "top", WIDE)).toEqual([
      "tooltip: left is 2px, expected 12px (±1px)",
      "tooltip: left is 2px, at least 12px expected",
    ]);
  });

  it("stands under the second row at 112px, centred on its entry", () => {
    const entry = { left: 150, top: 68, width: 32, height: 32 };
    expect(
      tooltipProblems({ left: 136, top: 112, width: 60, height: 28 }, entry, "second-row", NARROW),
    ).toEqual([]);
    expect(
      tooltipProblems({ left: 136, top: 60, width: 60, height: 28 }, entry, "second-row", NARROW),
    ).toEqual(["tooltip: top is 60px, expected 112px (±1px)"]);
  });

  it("accepts the second-row tooltip centred in the container as well (guide §5.15, open reading)", () => {
    const entry = { left: 150, top: 68, width: 32, height: 32 };
    const centredInContainer = NARROW.width / 2 - 30;
    expect(
      tooltipProblems(
        { left: centredInContainer, top: 112, width: 60, height: 28 },
        entry,
        "second-row",
        NARROW,
      ),
    ).toEqual([]);
    expect(
      tooltipProblems({ left: 300, top: 112, width: 60, height: 28 }, entry, "second-row", NARROW),
    ).toEqual(["tooltip: left is 300px, expected 136px (±1px)"]);
  });

  it("ends 60px above the bottom over the bottom row", () => {
    const zoomIn = { left: 1182, top: 852, width: 32, height: 32 };
    const tooltip = { left: 1150, top: 812, width: 96, height: 28 };
    expect(tooltipProblems(tooltip, zoomIn, "bottom", WIDE)).toEqual([]);
    expect(tooltipProblems({ ...tooltip, top: 852 }, zoomIn, "bottom", WIDE)).toEqual([
      "tooltip: bottom is 20px, expected 60px (±1px)",
    ]);
  });
});

describe("expectedFitInsets and freeRectangle", () => {
  it("are the guide's table in the top row and the second row", () => {
    expect(expectedFitInsets(measurement(), "ide")).toEqual({ top: 88, right: 24, bottom: 64, left: 24 });
    expect(freeRectangle(measurement(), "ide")).toEqual({ left: 24, top: 88, right: 1256, bottom: 836 });
    expect(expectedFitInsets(measurement({ container: NARROW }), "embedded")).toEqual({
      top: 140,
      right: 24,
      bottom: 64,
      left: 24,
    });
  });

  it("count the web app's pill, never another host's", () => {
    const withPill = measurement({ open: { problems: true } });
    expect(expectedFitInsets(withPill, "web").bottom).toBe(92);
    expect(expectedFitInsets(withPill, "ide").bottom).toBe(64);
  });

  it("count an open legend above 440px and a side inspector", () => {
    const legend = anchored(WIDE, { width: 200, height: 120 }, { left: 12, bottom: 12 });
    const inspector = anchored(WIDE, { width: 288, height: 700 }, { right: 12, top: 64 });
    expect(
      expectedFitInsets(
        measurement({ open: { legend: true, inspector: true }, islands: { legend, inspector } }),
        "ide",
      ),
    ).toEqual({ top: 88, right: 324, bottom: 64, left: 236 });
    const narrowLegend = anchored(VERY_NARROW, { width: 200, height: 120 }, { left: 12, bottom: 64 });
    expect(
      expectedFitInsets(
        measurement({ container: VERY_NARROW, open: { legend: true }, islands: { legend: narrowLegend } }),
        "ide",
      ).left,
    ).toBe(24);
  });

  it("end at the bottom sheet's top edge plus 12, where the legend does not count", () => {
    const sheet = anchored(NARROW, { width: 696, height: 300 }, { left: 12, bottom: 12 });
    const legend = anchored(NARROW, { width: 200, height: 120 }, { left: 12, bottom: 12 });
    const facts = measurement({
      container: NARROW,
      open: { inspector: true, legend: true },
      islands: { inspector: sheet, legend },
    });
    expect(expectedFitInsets(facts, "ide")).toEqual({ top: 140, right: 24, bottom: 324, left: 24 });
  });

  it("span the whole container on an axis the insets leave no room on", () => {
    const low = measurement({ container: { width: 1280, height: 120 } });
    expect(freeRectangle(low, "ide")).toEqual({ left: 24, top: 0, right: 1256, bottom: 120 });
  });
});
