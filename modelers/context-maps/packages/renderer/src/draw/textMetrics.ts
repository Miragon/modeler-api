import { FONT } from "./styles.js";

/**
 * Real text measurement so the rendered wrap matches the browser's own wrap
 * in the direct-editing box (same font, same width): a shared 2D context
 * measures actual glyph widths; the character-count heuristic remains only
 * as a fallback for environments without canvas support.
 */
let measureContext: CanvasRenderingContext2D | null | undefined;

/**
 * The advance width of `text` at zoom 1. A canvas measures it, not the SVG: Chromium lays SVG text
 * out at the scaled font size, so a width read from the drawing would change with the zoom.
 */
export function textWidth(text: string, fontSize: number, fontWeight: string): number {
  if (measureContext === undefined) {
    measureContext =
      typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  }
  if (!measureContext) return text.length * fontSize * 0.58;
  measureContext.font = `${fontWeight} ${fontSize}px ${FONT.family}`;
  return measureContext.measureText(text).width;
}
