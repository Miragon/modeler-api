import { describe, expect, it } from "vitest";

import { decidePaletteRow } from "../layout.js";
import { decideTopRow, type TopRow } from "./top-row.js";

const MENU_RIGHT = 12 + 40;
const PALETTE = 600;
const PRIMARY = { withLabel: 92, iconOnly: 40 };

function topRow(containerWidth: number, paletteWidth = PALETTE): TopRow {
  return decideTopRow({ containerWidth, paletteWidth, menuRight: MENU_RIGHT, primary: PRIMARY });
}

describe("decideTopRow (guide §5.15)", () => {
  // Palette 600 between a menu trigger ending at 52 and a primary action of 92 / 40:
  // labelled it needs (W + 600) / 2 ≤ W − 12 − 92 − 16, so W ≥ 840; icon only W ≥ 736, but up to
  // 760 the palette is in the second row anyway, where 52 + 16 ≤ W − 12 − 92 brings the label back.
  it.each([
    [1280, { paletteRow: "top", primaryLabel: "shown" }],
    [900, { paletteRow: "top", primaryLabel: "shown" }],
    [840, { paletteRow: "top", primaryLabel: "shown" }],
    [839, { paletteRow: "top", primaryLabel: "collapsed" }],
    [800, { paletteRow: "top", primaryLabel: "collapsed" }],
    [761, { paletteRow: "top", primaryLabel: "collapsed" }],
    [760, { paletteRow: "second-row", primaryLabel: "shown" }],
    [420, { paletteRow: "second-row", primaryLabel: "shown" }],
  ] as const)("at %ipx width: %o", (width, expected) => {
    expect(topRow(width)).toEqual(expected);
  });

  it("never moves the palette above 760px while the icon-only button leaves it room", () => {
    const moved = [];
    for (let width = 761; width <= 1400; width++) {
      if (topRow(width).paletteRow === "second-row") moved.push(width);
    }
    expect(moved).toEqual([]);
  });

  it("brings the label back in the second row while it keeps 16px to the menu trigger", () => {
    // 52 + 16 = 68 = 172 − 12 − 92
    expect(topRow(172)).toEqual({ paletteRow: "second-row", primaryLabel: "shown" });
    expect(topRow(171)).toEqual({ paletteRow: "second-row", primaryLabel: "collapsed" });
    expect(topRow(120)).toEqual({ paletteRow: "second-row", primaryLabel: "collapsed" });
  });

  it("tries the icon only when the label is what is in the way", () => {
    // The palette crowds the primary action (label 140): (900 + 700) / 2 = 800 > 900 − 12 − 140 − 16.
    expect(
      decideTopRow({
        containerWidth: 900,
        paletteWidth: 700,
        menuRight: MENU_RIGHT,
        primary: { withLabel: 140, iconOnly: 40 },
      }),
    ).toEqual({ paletteRow: "top", primaryLabel: "collapsed" });
  });

  it("moves the palette with the label kept when the menu trigger is what is in the way", () => {
    // (1100 − 1000) / 2 = 50 < 52 + 16: collapsing the label cannot help.
    expect(topRow(1100, 1000)).toEqual({ paletteRow: "second-row", primaryLabel: "shown" });
  });

  it("is decidePaletteRow alone without a primary action", () => {
    for (const width of [1280, 800, 761, 760, 400]) {
      expect(
        decideTopRow({ containerWidth: width, paletteWidth: PALETTE, menuRight: MENU_RIGHT }),
      ).toEqual({
        paletteRow: decidePaletteRow({
          containerWidth: width,
          paletteWidth: PALETTE,
          menuRight: MENU_RIGHT,
        }),
        primaryLabel: "shown",
      });
    }
  });
});
