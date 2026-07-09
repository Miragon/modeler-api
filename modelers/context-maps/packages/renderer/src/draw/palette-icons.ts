/**
 * Tiny inline-SVG glyphs for the palette / legend — the same shapes the canvas
 * draws (contexts coloured by subdomain, plus a relationship line). Returned as
 * HTML strings for diagram-js palette `html`.
 */

import {
  RELATIONSHIP_PATTERN_SPECS,
  SUBDOMAIN_TYPE_SPECS,
} from "@miragon/context-maps-schema-model";
import type { RelationshipPattern, SubdomainType } from "@miragon/context-maps-schema-model";

function svg(inner: string): string {
  return `<svg class="cm-palette-svg" width="24" height="24" viewBox="0 0 26 26" aria-hidden="true">${inner}</svg>`;
}

// Kaiser subdomain glyphs (Material star / pan_tool), 24×24 viewBox.
const STAR = "M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 7.1-1.01z";
const HAND =
  "M23 5.5V20c0 2.2-1.8 4-4 4h-7.3c-1.08 0-2.1-.43-2.85-1.19L1 14.83s1.26-1.23 1.3-1.25c.22-.19.49-.29.79-.29.22 0 .42.06.6.16.04.01 4.31 2.46 4.31 2.46V4c0-.83.67-1.5 1.5-1.5S11 3.17 11 4v7h1V1.5c0-.83.67-1.5 1.5-1.5S15 .67 15 1.5V11h1V2.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V11h1V5.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5z";

/** The subdomain glyph centred at (cx, cy) at `size` px: star / hand / dotted circle. */
function subdomainGlyph(
  type: SubdomainType,
  cx: number,
  cy: number,
  size: number,
  color: string,
): string {
  if (type === "generic") {
    return `<circle cx="${cx}" cy="${cy}" r="${size / 2 - 0.5}" fill="none" stroke="${color}" stroke-width="1.4" stroke-dasharray="1.8 1.8"/>`;
  }
  const scale = size / 24;
  const rot = type === "supporting" ? ` rotate(90 12 12)` : "";
  const t = `translate(${cx - 12 * scale} ${cy - 12 * scale}) scale(${scale})${rot}`;
  return `<path d="${type === "core" ? STAR : HAND}" fill="${color}" transform="${t}"/>`;
}

export function contextIconSvg(type: SubdomainType): string {
  const s = SUBDOMAIN_TYPE_SPECS[type];
  return svg(
    `<rect x="2" y="4" width="22" height="18" rx="3.5" fill="${s.fill}" stroke="${s.stroke}" stroke-width="1.5"/>` +
      subdomainGlyph(type, 13, 13, 12, s.stroke),
  );
}

export function relationshipIconSvg(pattern: RelationshipPattern = "upstream-downstream"): string {
  const s = RELATIONSHIP_PATTERN_SPECS[pattern];
  const dash = s.dash ? ` stroke-dasharray="${s.dash}"` : "";
  const w = Math.min(s.strokeWidth, 2.6);
  return svg(
    `<g stroke="${s.stroke}" stroke-width="${w}" stroke-linecap="round">` +
      `<circle cx="5" cy="13" r="2.5" fill="${s.stroke}" stroke="none"/>` +
      `<line x1="7" y1="13" x2="19" y2="13"${dash}/>` +
      `<circle cx="21" cy="13" r="2.5" fill="${s.stroke}" stroke="none"/></g>`,
  );
}
