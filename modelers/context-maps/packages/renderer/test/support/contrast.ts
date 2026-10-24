/**
 * WCAG 2.1 contrast for the notation tests, written out here instead of taken from the renderer so
 * the tests do not measure the renderer with its own ruler. Reads `#RRGGBB`, `#RGB` and the
 * `rgb(r, g, b)` / `rgba(r, g, b, a)` values `getComputedStyle` returns.
 */

export type Rgb = readonly [number, number, number];

export const TEXT_CONTRAST = 4.5;
export const NON_TEXT_CONTRAST = 3;

export function rgbOf(colour: string): Rgb {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(colour.trim());
  if (hex) {
    const digits =
      hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join("") : hex[1];
    const channel = (offset: number) => parseInt(digits.slice(offset, offset + 2), 16);
    return [channel(0), channel(2), channel(4)];
  }
  const functional = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(colour.trim());
  if (functional) return [Number(functional[1]), Number(functional[2]), Number(functional[3])];
  throw new Error(`expected a hex or rgb() colour, got "${colour}"`);
}

/** `colour` at `opacity` over `backdrop`, as the eye sees it. */
export function composite(colour: string, opacity: number, backdrop: string): Rgb {
  const foreground = rgbOf(colour);
  const background = rgbOf(backdrop);
  const mix = (index: 0 | 1 | 2) => foreground[index] * opacity + background[index] * (1 - opacity);
  return [mix(0), mix(1), mix(2)];
}

function relativeLuminance([red, green, blue]: Rgb): number {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

export function contrast(first: string | Rgb, second: string | Rgb): number {
  const toRgb = (colour: string | Rgb) => (typeof colour === "string" ? rgbOf(colour) : colour);
  const [lighter, darker] = [
    relativeLuminance(toRgb(first)),
    relativeLuminance(toRgb(second)),
  ].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * A pair below `minimum`, worded for the failure message (`"PL text: #ffffff on #c99a2e is
 * 2.58:1"`), or `undefined` when it holds.
 */
export function pairBelow(
  name: string,
  foreground: string | Rgb,
  background: string | Rgb,
  minimum: number,
): string | undefined {
  const ratio = contrast(foreground, background);
  if (ratio >= minimum) return undefined;
  const show = (colour: string | Rgb) =>
    typeof colour === "string" ? colour : `rgb(${colour.map(Math.round).join(", ")})`;
  return `${name}: ${show(foreground)} on ${show(background)} is ${ratio.toFixed(2)}:1`;
}
