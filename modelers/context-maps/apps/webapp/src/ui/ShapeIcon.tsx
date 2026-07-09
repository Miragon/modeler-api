/** Tiny SVG glyphs for the subdomain types and relationship patterns (legend / inspector). */

import {
  RELATIONSHIP_PATTERN_SPECS,
  SUBDOMAIN_TYPE_SPECS,
} from "@miragon/context-maps-schema-model";
import type { RelationshipPattern, SubdomainType } from "@miragon/context-maps-schema-model";

const SIZE = 26;

const STAR = "M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 7.1-1.01z";
const HAND =
  "M23 5.5V20c0 2.2-1.8 4-4 4h-7.3c-1.08 0-2.1-.43-2.85-1.19L1 14.83s1.26-1.23 1.3-1.25c.22-.19.49-.29.79-.29.22 0 .42.06.6.16.04.01 4.31 2.46 4.31 2.46V4c0-.83.67-1.5 1.5-1.5S11 3.17 11 4v7h1V1.5c0-.83.67-1.5 1.5-1.5S15 .67 15 1.5V11h1V2.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V11h1V5.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5z";

/** Kaiser subdomain icon: filled star (core), open hand (supporting), dotted circle (generic). */
export function SubdomainIcon({ type, size = SIZE }: { type: SubdomainType; size?: number }) {
  const spec = SUBDOMAIN_TYPE_SPECS[type];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {type === "generic" ? (
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke={spec.stroke}
          strokeWidth={1.8}
          strokeDasharray="2.4 2.4"
        />
      ) : (
        <path d={type === "core" ? STAR : HAND} fill={spec.stroke} />
      )}
    </svg>
  );
}

export function RelationshipIcon({
  pattern,
  size = SIZE,
}: {
  pattern: RelationshipPattern;
  size?: number;
}) {
  const spec = RELATIONSHIP_PATTERN_SPECS[pattern];
  const dash = spec.dash || undefined;
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden>
      <g stroke={spec.stroke} strokeWidth={Math.min(spec.strokeWidth, 2.6)} strokeLinecap="round">
        <circle cx="5" cy="13" r="2.5" fill={spec.stroke} stroke="none" />
        <line x1="7.5" y1="13" x2="18.5" y2="13" strokeDasharray={dash} />
        <circle cx="21" cy="13" r="2.5" fill={spec.stroke} stroke="none" />
      </g>
    </svg>
  );
}
