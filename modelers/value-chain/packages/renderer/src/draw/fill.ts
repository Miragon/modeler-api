import { canvasContext } from "./canvas2d.js";
import { COLORS, LABEL_ON_FILL } from "./styles.js";

type Rgba = readonly [red: number, green: number, blue: number, alpha: number];

export interface ShapeColors {
  /** The shape's fill: hex, or `rgba(…)` with transparency. */
  fill: string;
  /** The label's colour. */
  label: string;
}

/**
 * How a shape with the stored `color` is drawn (guide §10.6): the colour fills the shape and its
 * label is black or white, whichever contrasts more with that fill. The stored value never
 * changes, so a value from an older document (an `hsl()` accent, a colour name) fills the shape
 * too. Without a colour, or with a value that is no sRGB colour, the shape takes the plot and ink
 * roles. The contour stays ink either way.
 */
export function shapeColors(color: string | undefined): ShapeColors {
  const rgba = color === undefined ? undefined : readColor(color);
  if (!rgba) return { fill: COLORS.fill, label: COLORS.ink };
  return { fill: cssColor(rgba), label: labelColorOn(rgba) };
}

function readColor(value: string): Rgba | undefined {
  return parseColor(canonicalColor(value) ?? value);
}

/**
 * The browser's reading of any CSS colour: `#rrggbb`, or `rgba(…)` with transparency. A value the
 * browser rejects leaves `fillStyle` unchanged, so two runs from different starting colours tell a
 * colour from anything else.
 */
function canonicalColor(value: string): string | undefined {
  const context = canvasContext();
  if (!context) return undefined;
  context.fillStyle = COLORS.ink;
  context.fillStyle = value;
  const fromInk = String(context.fillStyle);
  context.fillStyle = COLORS.fill;
  context.fillStyle = value;
  return String(context.fillStyle) === fromInk ? fromInk : undefined;
}

function parseColor(value: string): Rgba | undefined {
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value.trim())?.[1];
  if (hex) {
    const digits = hex.length <= 4 ? [...hex].map((digit) => digit + digit).join("") : hex;
    const channel = (index: number) => parseInt(digits.slice(index * 2, index * 2 + 2), 16);
    return [channel(0), channel(1), channel(2), digits.length === 8 ? channel(3) / 255 : 1];
  }
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(
    value.trim(),
  );
  if (rgba) {
    const [, red, green, blue, alpha] = rgba;
    return [Number(red), Number(green), Number(blue), alpha === undefined ? 1 : Number(alpha)];
  }
  return undefined;
}

function cssColor([red, green, blue, alpha]: Rgba): string {
  if (alpha < 1) return `rgba(${red}, ${green}, ${blue}, ${Number(alpha.toFixed(3))})`;
  const hex = (channel: number) => channel.toString(16).padStart(2, "0");
  return `#${hex(red)}${hex(green)}${hex(blue)}`.toUpperCase();
}

/** Black or white, whichever contrasts more with the fill as it shows over the plot. */
function labelColorOn(fill: Rgba): string {
  const shown = overPlot(fill);
  const dark = contrastRatio(shown, tokenRgb(LABEL_ON_FILL.dark));
  const light = contrastRatio(shown, tokenRgb(LABEL_ON_FILL.light));
  return light > dark ? LABEL_ON_FILL.light : LABEL_ON_FILL.dark;
}

type Rgb = readonly [red: number, green: number, blue: number];

function tokenRgb(token: string): Rgb {
  const [red, green, blue] = parseColor(token) ?? [0, 0, 0];
  return [red, green, blue];
}

function overPlot([red, green, blue, alpha]: Rgba): Rgb {
  const plot = tokenRgb(COLORS.fill);
  const mix = (channel: number, under: number) => channel * alpha + under * (1 - alpha);
  return [mix(red, plot[0]), mix(green, plot[1]), mix(blue, plot[2])];
}

function relativeLuminance([red, green, blue]: Rgb): number {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

function contrastRatio(first: Rgb, second: Rgb): number {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort(
    (a, b) => b - a,
  ) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}
