import type { ElementBounds } from "@miragon/modeler-api";
import { contextDrawnSpan } from "../draw/contextLayout.js";
import { isCmContext, isCmRelationship } from "./di-types.js";

/**
 * The tight box around what the canvas draws of the map, in diagram coordinates, without a margin:
 * every context's box with the type's name and the team row where they run past its sides, and
 * every relationship's waypoints. The markers and role chips on a relationship sit between the
 * contexts it connects. `undefined` while there is nothing to draw.
 *
 * Read from the model, never from the SVG: Chromium measures SVG text at the scaled font size, so a
 * measured box would change with the zoom.
 */
export function contentBoundsOf(elements: Iterable<unknown>): ElementBounds | undefined {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  const include = (x: number, y: number, width: number, height: number): void => {
    if (![x, y, width, height].every(Number.isFinite)) return;
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x + width);
    bottom = Math.max(bottom, y + height);
  };
  for (const element of elements) {
    if (isCmContext(element)) {
      const span = contextDrawnSpan(element);
      include(span.left, element.y, span.right - span.left, element.height);
    } else if (isCmRelationship(element)) {
      for (const point of element.waypoints ?? []) include(point.x, point.y, 0, 0);
    }
  }
  if (left > right || top > bottom) return undefined;
  return { x: left, y: top, width: right - left, height: bottom - top };
}
