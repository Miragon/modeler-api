import type { Bounds } from "@miragon/value-chain-schema-model";
import { FONT } from "./styles.js";

/** The font diagram-js lays the labels out in (`TextUtil` builds the same string). */
const LABEL_FONT = `${FONT.size}px ${FONT.family}`;

let measuringContext: CanvasRenderingContext2D | null | undefined;

function canvasContext(): CanvasRenderingContext2D | null {
  // jsdom has no canvas and logs an error for every getContext call: ask only a real browser.
  measuringContext ??=
    typeof document !== "undefined" && typeof CanvasRenderingContext2D !== "undefined"
      ? document.createElement("canvas").getContext("2d")
      : null;
  return measuringContext;
}

/**
 * The box the lines of a laid-out label cover, in the coordinates of the shape it labels: every
 * line from its `tspan`'s start and baseline, as wide and as high as a 2D canvas measures it in the
 * label font, which is the measure diagram-js wrapped it by. Never read from the live SVG: Chromium
 * lays SVG text out at the zoomed font size, so that box would change with the zoom. `undefined`
 * where nothing can be measured.
 */
export function labelTextBox(text: SVGTextElement): Bounds | undefined {
  const context = canvasContext();
  if (!context) return undefined;
  context.font = LABEL_FONT;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const line of text.querySelectorAll("tspan")) {
    // As drawn: a line diagram-js broke after a space keeps it, and SVG advances over it.
    const content = line.textContent ?? "";
    if (!content.trim()) continue;
    const start = Number(line.getAttribute("x"));
    const baseline = Number(line.getAttribute("y"));
    const metrics = context.measureText(content);
    left = Math.min(left, start - Math.max(0, metrics.actualBoundingBoxLeft));
    right = Math.max(right, start + Math.max(metrics.width, metrics.actualBoundingBoxRight));
    top = Math.min(
      top,
      baseline - Math.max(metrics.fontBoundingBoxAscent, metrics.actualBoundingBoxAscent),
    );
    bottom = Math.max(
      bottom,
      baseline + Math.max(metrics.fontBoundingBoxDescent, metrics.actualBoundingBoxDescent),
    );
  }
  if (!(left <= right && top <= bottom)) return undefined;
  return { x: left, y: top, width: right - left, height: bottom - top };
}
