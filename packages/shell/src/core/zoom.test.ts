import { describe, expect, it } from "vitest";
import { defaultMessages } from "./messages.js";
import {
  ZOOM_MAX,
  ZOOM_MIN,
  canZoomIn,
  canZoomOut,
  formatNumber,
  formatPercent,
  zoomReadout,
} from "./zoom.js";

const NO_BREAK_SPACE = " ";

describe("zoom limits", () => {
  it("are diagram-js's ZoomScroll range", () => {
    expect(ZOOM_MIN).toBe(0.2);
    expect(ZOOM_MAX).toBe(4);
  });

  it("disable zoom out at 20 % and below, also with rounding noise", () => {
    expect(canZoomOut(0.2)).toBe(false);
    expect(canZoomOut(0.2 + 1e-12)).toBe(false);
    expect(canZoomOut(0.2002)).toBe(false);
    expect(canZoomOut(0.19)).toBe(false);
    expect(canZoomOut(0.048)).toBe(false);
    expect(canZoomOut(0.201)).toBe(true);
    expect(canZoomOut(0.224)).toBe(true);
    expect(canZoomOut(1)).toBe(true);
  });

  it("disable zoom in at 400 % and above, also with rounding noise", () => {
    expect(canZoomIn(4)).toBe(false);
    expect(canZoomIn(4 - 1e-12)).toBe(false);
    expect(canZoomIn(3.997)).toBe(false);
    expect(canZoomIn(4.5)).toBe(false);
    expect(canZoomIn(3.995)).toBe(true);
    expect(canZoomIn(3.314)).toBe(true);
    expect(canZoomIn(0.2)).toBe(true);
  });
});

describe("formatPercent", () => {
  it("writes a whole percentage in the UI language", () => {
    expect(formatPercent(0.86, "en")).toBe("86%");
    expect(formatPercent(0.861, "en")).toBe("86%");
    expect(formatPercent(1, "en")).toBe("100%");
    expect(formatPercent(3.314, "en")).toBe("331%");
    expect(formatPercent(0.2, "en-GB")).toBe("20%");
  });

  it("puts a no-break space before the German percent sign", () => {
    expect(formatPercent(0.86, "de")).toBe(`86${NO_BREAK_SPACE}%`);
    expect(formatPercent(1, "de-DE")).toBe(`100${NO_BREAK_SPACE}%`);
  });

  it("falls back to English for a language tag Intl rejects", () => {
    expect(formatPercent(0.86, "")).toBe("86%");
    expect(formatPercent(0.86, "not a language")).toBe("86%");
  });
});

describe("formatNumber", () => {
  it("formats through Intl in the UI language", () => {
    expect(formatNumber(2, "en")).toBe("2");
    expect(formatNumber(1234, "en")).toBe("1,234");
    expect(formatNumber(1234, "de")).toBe("1.234");
    expect(formatNumber(1234, "")).toBe("1,234");
  });
});

describe("zoomReadout", () => {
  it("names target and state in the aria-label", () => {
    expect(zoomReadout(0.86, "en", defaultMessages)).toEqual({
      text: "86%",
      ariaLabel: "Zoom to 100% (now 86%)",
      canZoomOut: true,
      canZoomIn: true,
    });
  });

  it("formats both numbers in the UI language of a localized table", () => {
    const readout = zoomReadout(0.86, "de", {
      zoomToActualNow: (percent, now) => `Auf ${percent} (jetzt ${now})`,
    });
    expect(readout.text).toBe(`86${NO_BREAK_SPACE}%`);
    expect(readout.ariaLabel).toBe(`Auf 100${NO_BREAK_SPACE}% (jetzt 86${NO_BREAK_SPACE}%)`);
  });

  it("reports the limits", () => {
    expect(zoomReadout(0.2, "en", defaultMessages)).toMatchObject({ canZoomOut: false, canZoomIn: true });
    expect(zoomReadout(4, "en", defaultMessages)).toMatchObject({
      text: "400%",
      canZoomOut: true,
      canZoomIn: false,
    });
  });
});
