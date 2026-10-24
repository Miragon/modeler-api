// @vitest-environment node
import { describe, expect, it } from "vitest";
import { contentBoundsOf } from "../src/model/contentBounds.js";

function context(
  id: string,
  x: number,
  y: number,
  width = 200,
  height = 110,
  decoration: { subdomainType?: string; team?: string } = {},
) {
  return { id, cmKind: "context", x, y, width, height, ...decoration };
}

function relationship(id: string, waypoints: Array<{ x: number; y: number }>) {
  return { id, cmKind: "relationship", pattern: "partnership", waypoints };
}

describe("contentBoundsOf", () => {
  it("is undefined while there is nothing to draw", () => {
    expect(contentBoundsOf([])).toBeUndefined();
    expect(contentBoundsOf([{ id: "cm-root" }])).toBeUndefined();
    expect(contentBoundsOf([relationship("r", [])])).toBeUndefined();
  });

  it("is the tight box around the contexts, without a margin", () => {
    expect(contentBoundsOf([context("a", -40, 20), context("b", 300, 180, 160, 90)])).toEqual({
      x: -40,
      y: 20,
      width: 500,
      height: 250,
    });
  });

  it("covers every relationship's waypoints, also where they leave the contexts' box", () => {
    const bounds = contentBoundsOf([
      context("a", 0, 0),
      context("b", 400, 0),
      relationship("r", [
        { x: 200, y: 55 },
        { x: 300, y: 260 },
        { x: 400, y: 55 },
      ]),
    ]);
    expect(bounds).toEqual({ x: 0, y: 0, width: 600, height: 260 });
  });

  it("is a box of size zero for a single point, and ignores what has no finite geometry", () => {
    expect(contentBoundsOf([relationship("r", [{ x: 7, y: 9 }])])).toEqual({
      x: 7,
      y: 9,
      width: 0,
      height: 0,
    });
    expect(
      contentBoundsOf([
        context("a", 10, 10),
        context("broken", Number.NaN, 0),
        { id: "shape-of-another-notation", x: -500, y: -500, width: 10, height: 10 },
      ]),
    ).toEqual({ x: 10, y: 10, width: 200, height: 110 });
  });

  it("leaves a context's box as it is while its type's name and team row fit inside", () => {
    expect(
      contentBoundsOf([
        context("a", 100, 50, 120, 72, { subdomainType: "core", team: "Blue" }),
        context("b", 300, 50, 200, 110, { subdomainType: "supporting", team: "Program Team" }),
      ]),
    ).toEqual({ x: 100, y: 50, width: 400, height: 110 });
  });

  it("widens it on both sides where the team row runs past them, centred as drawn", () => {
    const team = "Customer Experience Platform Engineering Squad";
    const bounds = contentBoundsOf([context("a", 100, 50, 200, 110, { team })])!;
    // The renderer centres the team glyph (14), its gap (5) and the estimated name on the box.
    expect(bounds.x).toBeCloseTo(200 - (14 + 5 + team.length * 11 * 0.55) / 2, 9);
    expect(bounds.x + bounds.width).toBeGreaterThan(300);
    expect({ y: bounds.y, height: bounds.height }).toEqual({ y: 50, height: 110 });
  });

  it("widens it on the right where the type's name runs past a narrow box", () => {
    const bounds = contentBoundsOf([
      context("a", 100, 50, 120, 72, { subdomainType: "supporting" }),
    ])!;
    expect(bounds.x).toBe(100);
    expect(bounds.x + bounds.width).toBeGreaterThan(220);
    expect({ y: bounds.y, height: bounds.height }).toEqual({ y: 50, height: 72 });
  });
});
