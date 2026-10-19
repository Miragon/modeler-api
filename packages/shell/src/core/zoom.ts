import type { ShellMessages } from "./messages.js";

/** diagram-js `ZoomScroll` RANGE (not configurable): 20 % … 400 %. */
export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 4;

/** Zoom out is disabled at 20 % and below (`zoom <= 0.2 · 1.001`), so it never zooms in. */
export function canZoomOut(zoom: number): boolean {
  return zoom > ZOOM_MIN * 1.001;
}

/** Zoom in is disabled at 400 % (`zoom >= 4 · 0.999`). */
export function canZoomIn(zoom: number): boolean {
  return zoom < ZOOM_MAX * 0.999;
}

/**
 * A zoom as a whole percentage in the UI language: `Intl.NumberFormat(lang, { style: "percent",
 * maximumFractionDigits: 0 })`, so English "86%", German "86 %" (with U+00A0).
 */
export function formatPercent(zoom: number, lang: string): string {
  return numberFormat(lang, "percent").format(zoom);
}

/** Any other number in the chrome ("2 problems"), via `Intl.NumberFormat(lang)`. */
export function formatNumber(value: number, lang: string): string {
  return numberFormat(lang, "decimal").format(value);
}

const FALLBACK_LANG = "en";
const formats = new Map<string, Intl.NumberFormat>();

// The readout formats on every animation frame of a zoom, so each formatter is built once. A
// language tag Intl rejects (an empty `lang=""`, a typo) falls back to English, the shell's default
// language, instead of breaking the chrome.
function numberFormat(lang: string, style: "percent" | "decimal"): Intl.NumberFormat {
  const key = `${style}|${lang}`;
  let format = formats.get(key);
  if (!format) {
    const options: Intl.NumberFormatOptions =
      style === "percent" ? { style, maximumFractionDigits: 0 } : { style };
    try {
      format = new Intl.NumberFormat(lang, options);
    } catch {
      format = new Intl.NumberFormat(FALLBACK_LANG, options);
    }
    formats.set(key, format);
  }
  return format;
}

export interface ZoomReadout {
  /** "86%" */
  text: string;
  /** "Zoom to 100% (now 86%)" */
  ariaLabel: string;
  canZoomOut: boolean;
  canZoomIn: boolean;
}

/** Everything the zoom panel shows for a zoom: readout text, its accessible name and the limits. */
export function zoomReadout(
  zoom: number,
  lang: string,
  messages: Pick<ShellMessages, "zoomToActualNow">,
): ZoomReadout {
  const text = formatPercent(zoom, lang);
  return {
    text,
    ariaLabel: messages.zoomToActualNow(formatPercent(1, lang), text),
    canZoomOut: canZoomOut(zoom),
    canZoomIn: canZoomIn(zoom),
  };
}
