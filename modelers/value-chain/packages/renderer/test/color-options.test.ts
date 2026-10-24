import { describe, expect, it } from "vitest";
import { fest } from "../src/theme/cd-tokens.generated.json";
import { COLOR_OPTIONS } from "../src/draw/styles.js";

/**
 * Guide §10.6: the picker starts with "Default", which stores no colour, and then offers the
 * palette and the status colours as fill colours. Text on such a fill is black or white, so every
 * fill must carry one of them at 4.5:1 at least.
 */

function rgb(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`not a #rrggbb colour: ${hex}`);
  const digits = match[1]!;
  return [0, 2, 4].map((index) => parseInt(digits.slice(index, index + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function luminance(hex: string): number {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const [red, green, blue] = rgb(hex);
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

function contrast(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}

const PALETTE_AND_STATUS = [
  "--cd-blau",
  "--cd-gruen",
  "--cd-grau",
  "--cd-schwarz",
  "--cd-weiss",
  "--cd-success",
  "--cd-warning",
  "--cd-danger",
  "--cd-info",
] as const;

const fills = COLOR_OPTIONS.flatMap((option) => (option.color === undefined ? [] : [option]));

describe("the colour picker follows guide §10.6", () => {
  it('starts with "Default", which stores no colour', () => {
    expect(COLOR_OPTIONS[0]).toEqual({ label: "Default" });
    expect(COLOR_OPTIONS.filter((option) => option.color === undefined)).toHaveLength(1);
  });

  it("offers only palette and status colours of the vendored tokens", () => {
    const allowed = new Set(PALETTE_AND_STATUS.map((token) => fest[token].toUpperCase()));
    for (const option of fills) {
      expect(allowed.has(option.color!.toUpperCase()), `${option.label} ${option.color}`).toBe(
        true,
      );
    }
  });

  it("offers every palette and status hue once that differs from the white plot", () => {
    expect(COLOR_OPTIONS.map((option) => [option.label, option.color])).toEqual([
      ["Default", undefined],
      ["Blue", fest["--cd-blau"]],
      ["Green", fest["--cd-gruen"]],
      ["Black", fest["--cd-schwarz"]],
      ["Amber", fest["--cd-warning"]],
      ["Red", fest["--cd-danger"]],
    ]);
    expect(new Set(fills.map((option) => option.color!.toUpperCase())).size).toBe(fills.length);
  });

  it("gives every fill a black or white label at 4.5:1 at least", () => {
    for (const option of fills) {
      const best = Math.max(
        contrast(option.color!, fest["--cd-schwarz"]),
        contrast(option.color!, fest["--cd-weiss"]),
      );
      expect(best, `${option.label} ${option.color}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
