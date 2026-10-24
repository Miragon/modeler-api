/**
 * Tiny inline-SVG glyphs for the palette / legend — the same shapes the canvas
 * draws (contexts coloured by subdomain, plus a relationship line). Returned as
 * HTML strings for diagram-js palette `html`.
 */

import {
  RELATIONSHIP_PATTERN_SPECS,
  SUBDOMAIN_TYPE_SPECS,
} from "@miragon/context-maps-schema-model";
import type {
  DownstreamRole,
  RelationshipPattern,
  SubdomainType,
  SubdomainTypeSpec,
  UpstreamRole,
} from "@miragon/context-maps-schema-model";
import { contextBadgeColour } from "./contextColours.js";
import { markFill, markTextColour } from "./relationshipColours.js";
import { FONT, NEUTRAL_FILL, NEUTRAL_STROKE } from "./styles.js";
import { HAND_PATH, STAR_PATH } from "./subdomainGlyphs.js";

function svg(inner: string, size = 24): string {
  return `<svg class="cm-palette-svg" width="${size}" height="${size}" viewBox="0 0 26 26" aria-hidden="true">${inner}</svg>`;
}

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
  return `<path d="${type === "core" ? STAR_PATH : HAND_PATH}" fill="${color}" transform="${t}"/>`;
}

/** No (or unknown) type → the neutral box an unclassified context gets on the canvas. */
export function contextIconSvg(type?: SubdomainType): string {
  const s = type ? SUBDOMAIN_TYPE_SPECS[type] : undefined;
  if (!type || !s) {
    return svg(
      `<rect x="2" y="4" width="22" height="18" rx="3.5" fill="${NEUTRAL_FILL}" stroke="${NEUTRAL_STROKE}" stroke-width="1.5"/>`,
    );
  }
  return svg(
    `<rect x="2" y="4" width="22" height="18" rx="3.5" fill="${s.fill}" stroke="${s.stroke}" stroke-width="1.5"/>` +
      subdomainGlyph(type, 13, 13, 12, contextBadgeColour({ subdomainType: type })),
  );
}

/** The bare subdomain glyph (star / hand / dotted circle) without the box — legend rows. */
export function subdomainIconSvg(type: SubdomainType, size = 18): string {
  const s = SUBDOMAIN_TYPE_SPECS[type] as SubdomainTypeSpec | undefined;
  const color = contextBadgeColour({ subdomainType: type });
  const inner =
    !s || type === "generic"
      ? `<circle cx="12" cy="12" r="9" fill="none" stroke="${color}" stroke-width="1.8" stroke-dasharray="2.4 2.4"/>`
      : `<path d="${type === "core" ? STAR_PATH : HAND_PATH}" fill="${color}"/>`;
  return `<svg class="cm-palette-svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
}

/** The same coloured role chip (OHS/PL/ACL/CF) the canvas draws at relationship ends. */
export function roleChipSvg(role: UpstreamRole | DownstreamRole): string {
  return svg(
    `<rect x="1" y="6.5" width="24" height="13" rx="3" fill="${markFill(role)}"/>` +
      `<text x="13" y="16.4" text-anchor="middle" font-size="9.5" font-weight="700" fill="${markTextColour(role)}" font-family="${FONT.family}">${role}</text>`,
  );
}

export function relationshipIconSvg(
  pattern: RelationshipPattern = "upstream-downstream",
  size = 24,
): string {
  const s =
    RELATIONSHIP_PATTERN_SPECS[pattern] ?? RELATIONSHIP_PATTERN_SPECS["upstream-downstream"];
  const dash = s.dash ? ` stroke-dasharray="${s.dash}"` : "";
  const w = Math.min(s.strokeWidth, 2.6);
  return svg(
    `<g stroke="${s.stroke}" stroke-width="${w}" stroke-linecap="round">` +
      `<circle cx="5" cy="13" r="2.5" fill="${s.stroke}" stroke="none"/>` +
      `<line x1="7" y1="13" x2="19" y2="13"${dash}/>` +
      `<circle cx="21" cy="13" r="2.5" fill="${s.stroke}" stroke="none"/></g>`,
    size,
  );
}
