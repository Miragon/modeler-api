import type { ShellMessages } from "./messages.js";

/** diagram-js `ZoomScroll` RANGE (not configurable): 20 % … 400 %. */
export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 4;

/** Zoom out is disabled at 20 % and below (`zoom <= 0.2 · 1.001`), so it never zooms in. */
export function canZoomOut(zoom: number): boolean {
  throw new Error("@miragon/modeler-shell: canZoomOut is not implemented yet");
}

/** Zoom in is disabled at 400 % (`zoom >= 4 · 0.999`). */
export function canZoomIn(zoom: number): boolean {
  throw new Error("@miragon/modeler-shell: canZoomIn is not implemented yet");
}

/**
 * A zoom as a whole percentage in the UI language: `Intl.NumberFormat(lang, { style: "percent",
 * maximumFractionDigits: 0 })`, so English "86%", German "86 %" (with U+00A0).
 */
export function formatPercent(zoom: number, lang: string): string {
  throw new Error("@miragon/modeler-shell: formatPercent is not implemented yet");
}

/** Any other number in the chrome ("2 problems"), via `Intl.NumberFormat(lang)`. */
export function formatNumber(value: number, lang: string): string {
  throw new Error("@miragon/modeler-shell: formatNumber is not implemented yet");
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
  throw new Error("@miragon/modeler-shell: zoomReadout is not implemented yet");
}
