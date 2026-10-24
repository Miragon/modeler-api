import { canvasContext } from "./canvas2d.js";
import { COLORS, LABEL_ON_FILL } from "./styles.js";

type Rgba = readonly [red: number, green: number, blue: number, alpha: number];

type Rgb = readonly [red: number, green: number, blue: number];

export interface ShapeColors {
  /** The shape's fill: hex, or `rgba(…)` with transparency. */
  fill: string;
  /** The label's colour. */
  label: string;
  /**
   * The halo around the label's glyphs, opaque hex: the fill as it shows over the plot. Inside the
   * shape nobody sees it; label lines that run past the shape keep their contrast through it.
   * `undefined` without a colour of the shape's own, where the label is ink.
   */
  halo?: string;
}

/**
 * How a shape with the stored `color` is drawn (guide §10.6): the colour fills the shape and its
 * label is black or white, whichever contrasts more with that fill. The stored value never
 * changes, so a value from an older document (an `hsl()` accent, a colour name) fills the shape
 * too. Without a colour, or with a value that is no CSS colour, the shape takes the plot and ink
 * roles. The contour stays ink either way.
 */
export function shapeColors(color: string | undefined): ShapeColors {
  const rgba = color === undefined ? undefined : readColor(color);
  if (!rgba) return { fill: COLORS.fill, label: COLORS.ink };
  const shown = overPlot(rgba);
  return { fill: cssColor(rgba), label: labelColorOn(shown), halo: hexColor(shown) };
}

const readColors = new Map<string, Rgba | undefined>();

function readColor(value: string): Rgba | undefined {
  if (!readColors.has(value)) readColors.set(value, browserColor(value));
  return readColors.get(value);
}

function browserColor(value: string): Rgba | undefined {
  const context = canvasContext();
  if (!context) return undefined;
  const canonical = canonicalColor(context, value);
  if (canonical === undefined) return undefined;
  return parseColor(canonical) ?? paintedColor(context, canonical);
}

/**
 * The browser's reading of a CSS colour: `#rrggbb` or `rgba(…)` for the sRGB syntaxes, the value
 * as written for newer ones (`oklch()`, `lab()`, `color()`). A value the browser rejects leaves
 * `fillStyle` unchanged, so two runs from different starting colours tell a colour from anything
 * else.
 */
function canonicalColor(context: CanvasRenderingContext2D, value: string): string | undefined {
  context.fillStyle = COLORS.ink;
  context.fillStyle = value;
  const fromInk = String(context.fillStyle);
  context.fillStyle = COLORS.fill;
  context.fillStyle = value;
  return String(context.fillStyle) === fromInk ? fromInk : undefined;
}

/** A colour in a syntax newer than `rgb()`, read from one pixel painted in it. */
function paintedColor(context: CanvasRenderingContext2D, value: string): Rgba {
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const [red = 0, green = 0, blue = 0, alpha = 0] = context.getImageData(0, 0, 1, 1).data;
  context.clearRect(0, 0, 1, 1);
  return [red, green, blue, Number((alpha / 255).toFixed(3))];
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
  return hexColor([red, green, blue]);
}

function hexColor(rgb: Rgb): string {
  const hex = (channel: number) => Math.round(channel).toString(16).padStart(2, "0");
  return `#${rgb.map(hex).join("")}`.toUpperCase();
}

/** Black or white, whichever contrasts more with the fill as it shows. */
function labelColorOn(shown: Rgb): string {
  const dark = contrastRatio(shown, tokenRgb(LABEL_ON_FILL.dark));
  const light = contrastRatio(shown, tokenRgb(LABEL_ON_FILL.light));
  return light > dark ? LABEL_ON_FILL.light : LABEL_ON_FILL.dark;
}

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
