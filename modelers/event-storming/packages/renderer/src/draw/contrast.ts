import { MIRAGON } from "../theme/index.js";

/** sRGB channels 0 to 255 and the alpha 0 to 1. */
type Rgba = readonly [red: number, green: number, blue: number, alpha: number];

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const SERIALIZED_RGBA = /^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)$/;

function parseHex(color: string): Rgba | undefined {
  if (!HEX_COLOR.test(color)) return undefined;
  const short = color.length <= 5;
  const digits = short
    ? [...color.slice(1)].map((digit) => digit + digit).join("")
    : color.slice(1);
  const channel = (index: number) => parseInt(digits.slice(index * 2, index * 2 + 2), 16);
  return [channel(0), channel(1), channel(2), digits.length === 8 ? channel(3) / 255 : 1];
}

let canvasColorParser: OffscreenCanvasRenderingContext2D | null | undefined;

/**
 * The DSL also takes CSS colour names (`(color green)`) and a stored board any CSS colour, so
 * everything but hex goes through the browser's own parser: a 2D context serializes `fillStyle`
 * as `#rrggbb` or `rgba(…)`. Without a canvas (jsdom) the colour stays unread.
 */
function parseWithCanvas(color: string): Rgba | undefined {
  if (canvasColorParser === undefined) {
    canvasColorParser =
      typeof OffscreenCanvas === "undefined" ? null : new OffscreenCanvas(1, 1).getContext("2d");
  }
  if (!canvasColorParser) return undefined;
  // A value that is no colour leaves `fillStyle` as it was, so two start values tell it apart.
  canvasColorParser.fillStyle = MIRAGON.schwarz;
  canvasColorParser.fillStyle = color;
  const fromDark = String(canvasColorParser.fillStyle);
  canvasColorParser.fillStyle = MIRAGON.weiss;
  canvasColorParser.fillStyle = color;
  if (String(canvasColorParser.fillStyle) !== fromDark) return undefined;
  const serialized = SERIALIZED_RGBA.exec(fromDark);
  if (!serialized) return parseHex(fromDark);
  const [, red, green, blue, alpha] = serialized;
  return [Number(red), Number(green), Number(blue), alpha === undefined ? 1 : Number(alpha)];
}

function parseColor(color: string): Rgba | undefined {
  const trimmed = color.trim();
  return parseHex(trimmed) ?? parseWithCanvas(trimmed);
}

/** A translucent colour as it shows over an opaque ground. */
function over([red, green, blue, alpha]: Rgba, ground: Rgba): Rgba {
  const mix = (top: number, bottom: number) => top * alpha + bottom * (1 - alpha);
  return [mix(red, ground[0]), mix(green, ground[1]), mix(blue, ground[2]), 1];
}

function relativeLuminance([red, green, blue]: Rgba): number {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

function ratio(first: Rgba, second: Rgba): number {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort(
    (a, b) => b - a,
  );
  return (lighter! + 0.05) / (darker! + 0.05);
}

const CANVAS_GROUND = parseHex(MIRAGON.grau)!;
const BLACK_TEXT = parseHex(MIRAGON.schwarz)!;
const WHITE_TEXT = parseHex(MIRAGON.weiss)!;

/**
 * Text colour on a sticky's fill (guide §10.6): `schwarz` or `weiss`, whichever contrasts more
 * with the fill, so a fill the user picks keeps its text readable. A translucent fill counts as
 * it shows over the canvas ground; a fill the renderer cannot read keeps `schwarz`.
 */
export function textColorOn(fill: string): typeof MIRAGON.schwarz | typeof MIRAGON.weiss {
  const parsed = parseColor(fill);
  if (!parsed) return MIRAGON.schwarz;
  const shown = over(parsed, CANVAS_GROUND);
  return ratio(shown, WHITE_TEXT) > ratio(shown, BLACK_TEXT) ? MIRAGON.weiss : MIRAGON.schwarz;
}
