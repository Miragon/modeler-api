import { describe, expect, it } from "vitest";

import { zoomRowRaised } from "./bottom-row.js";

describe("zoomRowRaised (web bottom row)", () => {
  const ZOOM = 173;
  const LEGAL_RIGHT = 300;

  it("keeps the zoom panel in the bottom row while 8px stay to the legal line", () => {
    expect(zoomRowRaised({ containerWidth: 1280, legalRight: LEGAL_RIGHT, zoomWidth: ZOOM })).toBe(
      false,
    );
    // zoom left = 493 − 12 − 173 = 308 = 300 + 8
    expect(zoomRowRaised({ containerWidth: 493, legalRight: LEGAL_RIGHT, zoomWidth: ZOOM })).toBe(
      false,
    );
  });

  it("raises it once less than 8px would stay", () => {
    expect(zoomRowRaised({ containerWidth: 492, legalRight: LEGAL_RIGHT, zoomWidth: ZOOM })).toBe(
      true,
    );
    expect(zoomRowRaised({ containerWidth: 360, legalRight: LEGAL_RIGHT, zoomWidth: ZOOM })).toBe(
      true,
    );
  });

  it("follows the measured widths, not fixed ones", () => {
    expect(zoomRowRaised({ containerWidth: 493, legalRight: 301, zoomWidth: ZOOM })).toBe(true);
    expect(zoomRowRaised({ containerWidth: 493, legalRight: LEGAL_RIGHT, zoomWidth: 174 })).toBe(
      true,
    );
    expect(zoomRowRaised({ containerWidth: 493, legalRight: LEGAL_RIGHT, zoomWidth: 172 })).toBe(
      false,
    );
  });

  it("is false while either of the two is not shown", () => {
    expect(zoomRowRaised({ containerWidth: 360, zoomWidth: ZOOM })).toBe(false);
    expect(zoomRowRaised({ containerWidth: 360, legalRight: LEGAL_RIGHT })).toBe(false);
    expect(
      zoomRowRaised({ containerWidth: 360, legalRight: undefined, zoomWidth: undefined }),
    ).toBe(false);
  });
});
