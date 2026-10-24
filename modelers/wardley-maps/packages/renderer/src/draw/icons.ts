import { append as svgAppend, attr as svgAttr, create as svgCreate } from "tiny-svg";

/**
 * Embedded icon paths from Google Material Icons (Apache-2.0, © Google), 24x24-viewBox paths:
 * the notation glyphs the canvas and the palette draw (anchor, accelerator, deaccelerator; guide
 * §3.6 keeps them until the modelers' dark mode) and the paths behind the deprecated `ICON_*`
 * exports. `drawIcon` renders them as SVG, `iconMarkup` as an HTML string with
 * `fill: currentColor`. The context pad draws Lucide icons (`lucide.ts`).
 * Source: https://github.com/google/material-design-icons (Apache License 2.0).
 */

export const ICON_PERSON =
  "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z";
export const ICON_EDIT =
  "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z";
export const ICON_DELETE =
  "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z";
/** fast_forward — Accelerator. */
export const ICON_FAST_FORWARD = "M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z";
/** fast_rewind — Deaccelerator. */
export const ICON_FAST_REWIND = "M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z";

/** Draws a 24x24 icon as an SVG group centered on (cx, cy), scaled to `size`. */
export function drawIcon(
  path: string,
  cx: number,
  cy: number,
  size: number,
  fill: string,
): SVGElement {
  const g = svgCreate("g");
  const s = size / 24;
  svgAttr(g, {
    transform: `translate(${cx - size / 2}, ${cy - size / 2}) scale(${s})`,
    fill,
    stroke: "none",
  });
  svgAppend(g, svgAttr(svgCreate("path"), { d: path }));
  return g;
}

/** Icon paths are public API input, so they are escaped before they land in an HTML attribute. */
function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Returns an icon as an HTML SVG string, color = currentColor (behind the deprecated export). */
export function iconMarkup(path: string, size = 18): string {
  return `<svg viewBox="0 0 24 24" width="${Number(size)}" height="${Number(size)}" fill="currentColor" aria-hidden="true"><path d="${escapeAttribute(path)}"/></svg>`;
}
