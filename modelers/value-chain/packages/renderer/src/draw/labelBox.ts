import type { Bounds } from "@miragon/value-chain-schema-model";
import { canvasContext } from "./canvas2d.js";
import { FONT } from "./styles.js";

/** The font diagram-js lays the labels out in (`TextUtil` builds the same string). */
const LABEL_FONT = `${FONT.size}px ${FONT.family}`;

export interface LabelLine {
  element: SVGTSpanElement;
  box: Bounds;
}

/**
 * The lines of a laid-out label and the box each covers, in the coordinates of the shape it
 * labels: from its `tspan`'s start and baseline, as wide and as high as a 2D canvas measures it in
 * the label font, which is the measure diagram-js wrapped it by. Never read from the live SVG:
 * Chromium lays SVG text out at the zoomed font size, so that box would change with the zoom.
 * Empty where nothing can be measured.
 */
export function labelLines(text: SVGTextElement): LabelLine[] {
  const context = canvasContext();
  if (!context) return [];
  context.font = LABEL_FONT;
  const lines: LabelLine[] = [];
  for (const element of text.querySelectorAll("tspan")) {
    // As drawn: a line diagram-js broke after a space keeps it, and SVG advances over it.
    const content = element.textContent ?? "";
    if (!content.trim()) continue;
    const start = Number(element.getAttribute("x"));
    const baseline = Number(element.getAttribute("y"));
    const metrics = context.measureText(content);
    const left = start - Math.max(0, metrics.actualBoundingBoxLeft);
    const right = start + Math.max(metrics.width, metrics.actualBoundingBoxRight);
    const top = baseline - Math.max(metrics.fontBoundingBoxAscent, metrics.actualBoundingBoxAscent);
    const bottom =
      baseline + Math.max(metrics.fontBoundingBoxDescent, metrics.actualBoundingBoxDescent);
    if (left <= right && top <= bottom) {
      lines.push({ element, box: { x: left, y: top, width: right - left, height: bottom - top } });
    }
  }
  return lines;
}

export function linesBox(lines: readonly LabelLine[]): Bounds | undefined {
  if (lines.length === 0) return undefined;
  const left = Math.min(...lines.map(({ box }) => box.x));
  const top = Math.min(...lines.map(({ box }) => box.y));
  const right = Math.max(...lines.map(({ box }) => box.x + box.width));
  const bottom = Math.max(...lines.map(({ box }) => box.y + box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}
