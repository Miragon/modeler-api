import { describe, expect, it } from "vitest";
import {
  chevronPath,
  chevronPathAt,
  chevronSpanAt,
  ellipseSpanAt,
  notchDepth,
  shapeHoldsLine,
} from "../src/draw/geometry.js";

describe("notchDepth", () => {
  it("is half the height for regular proportions", () => {
    expect(notchDepth(160, 60)).toBe(30);
  });

  it("clamps for very narrow steps", () => {
    expect(notchDepth(50, 60)).toBe(20);
  });
});

describe("chevronPath", () => {
  it("produces a closed six-point path", () => {
    const path = chevronPath(160, 60);
    expect(path).toBe("M0,0L130,0L160,30L130,60L0,60L30,30Z");
  });

  it("offsets by the shape position in absolute form", () => {
    expect(chevronPathAt(10, 20, 160, 60)).toBe("M10,20L140,20L170,50L140,80L10,80L40,50Z");
  });
});

describe("chevronSpanAt", () => {
  it("runs from the notch to the point at every height of the step", () => {
    expect(chevronSpanAt(160, 60, 0)).toEqual([0, 130]);
    expect(chevronSpanAt(160, 60, 15)).toEqual([15, 145]);
    expect(chevronSpanAt(160, 60, 30)).toEqual([30, 160]);
    expect(chevronSpanAt(160, 60, 60)).toEqual([0, 130]);
  });

  it("is empty above and below the step", () => {
    expect(chevronSpanAt(160, 60, -0.5)).toBeUndefined();
    expect(chevronSpanAt(160, 60, 60.5)).toBeUndefined();
  });
});

describe("ellipseSpanAt", () => {
  it("is the full width at the middle and narrows towards the top and bottom", () => {
    expect(ellipseSpanAt(130, 60, 30)).toEqual([0, 130]);
    const [left, right] = ellipseSpanAt(130, 60, 6)!;
    expect(left).toBeCloseTo(26);
    expect(right).toBeCloseTo(104);
    expect(ellipseSpanAt(130, 60, 0)).toEqual([65, 65]);
  });

  it("is empty above and below the ellipse", () => {
    expect(ellipseSpanAt(130, 60, -1)).toBeUndefined();
    expect(ellipseSpanAt(130, 60, 61)).toBeUndefined();
  });
});

describe("shapeHoldsLine", () => {
  const line = (y: number, x = 20, width = 120) => ({ x, y, width, height: 14 });

  it("holds a line in the middle of the step, also where its ends reach into notch and point", () => {
    expect(shapeHoldsLine(false, 160, 60, line(23))).toBe(true);
    expect(shapeHoldsLine(false, 160, 60, line(23, 25, 135))).toBe(true);
  });

  it("holds a line that crosses the edge with most of its middle on the shape", () => {
    expect(shapeHoldsLine(false, 160, 60, line(-6))).toBe(true);
    expect(shapeHoldsLine(false, 160, 60, line(52))).toBe(true);
  });

  it("does not hold a line whose middle lies past the shape", () => {
    expect(shapeHoldsLine(false, 160, 60, line(-8))).toBe(false);
    expect(shapeHoldsLine(false, 160, 60, line(54))).toBe(false);
    expect(shapeHoldsLine(false, 100, 40, line(-20, 15, 70))).toBe(false);
  });

  it("does not hold a line on an ellipse's top whose middle is mostly beside the curve", () => {
    expect(shapeHoldsLine(true, 100, 40, line(-6, 12, 76))).toBe(false);
    expect(shapeHoldsLine(true, 100, 40, line(13, 12, 76))).toBe(true);
  });
});
