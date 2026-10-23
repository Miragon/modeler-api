import { SUBDOMAIN_TYPE_SPECS, type SubdomainType } from "@miragon/context-maps-schema-model";
import type { CmContext } from "../model/di-types.js";
import { FONT } from "./styles.js";
import { textWidth } from "./textMetrics.js";

/** The subdomain type's name in a context's header, right of its icon (context coordinates). */
export const TYPE_LABEL = { x: 28, y: 15, fontWeight: "700", letterSpacingEm: 0.03 } as const;

export const TEAM_ICON_SIZE = 14;
const TEAM_ICON_GAP = 5;
const TEAM_ROW_FROM_BOTTOM = 12;

/** The people icon and the team's name at the bottom of a context, in context coordinates. */
export interface TeamRowLayout {
  /** The icon's left edge, where the row starts. */
  left: number;
  iconCenterX: number;
  textX: number;
  centerY: number;
  /** Where the team's name ends as the canvas draws it. */
  right: number;
}

export function teamRowLayout(
  contextWidth: number,
  contextHeight: number,
  team: string,
): TeamRowLayout {
  // Centred on an estimate of the name's width, which no font load changes, so the row stays where
  // it is drawn; only its end follows the font the canvas shows.
  const estimatedTextWidth = team.length * FONT.small * 0.55;
  const left = contextWidth / 2 - (TEAM_ICON_SIZE + TEAM_ICON_GAP + estimatedTextWidth) / 2;
  const textX = left + TEAM_ICON_SIZE + TEAM_ICON_GAP;
  return {
    left,
    iconCenterX: left + TEAM_ICON_SIZE / 2,
    textX,
    centerY: contextHeight - TEAM_ROW_FROM_BOTTOM,
    right: textX + textWidth(team, FONT.small, "400"),
  };
}

/** Where the subdomain type's name in the header ends, in context coordinates. */
export function typeLabelRight(type: SubdomainType): number {
  const { label } = SUBDOMAIN_TYPE_SPECS[type];
  const letterSpacing = TYPE_LABEL.letterSpacingEm * FONT.small;
  return (
    TYPE_LABEL.x +
    textWidth(label, FONT.small, TYPE_LABEL.fontWeight) +
    label.length * letterSpacing
  );
}

/**
 * The horizontal span a context draws, in diagram coordinates: its box, wider where the type's
 * name or the team row runs past its sides, since neither is cut to the box. Vertically both stay
 * inside, as every context is at least the notation's minimum size.
 */
export function contextDrawnSpan(
  context: Pick<CmContext, "x" | "width" | "subdomainType" | "team">,
): { left: number; right: number } {
  let left = 0;
  let right = context.width;
  if (context.subdomainType && SUBDOMAIN_TYPE_SPECS[context.subdomainType]) {
    right = Math.max(right, typeLabelRight(context.subdomainType));
  }
  if (context.team) {
    const row = teamRowLayout(context.width, 0, context.team);
    left = Math.min(left, row.left);
    right = Math.max(right, row.right);
  }
  return { left: context.x + left, right: context.x + right };
}
