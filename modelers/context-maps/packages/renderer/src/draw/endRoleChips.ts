/**
 * Geometry of the role-chip group at a relationship end (the OHS/PL/ACL/CF
 * badges next to the direction letter). Kept in one place so the renderer
 * (which draws the chips) and the validation markers (which anchor to the
 * chips' bottom-right corner) can never drift apart.
 */

import type { Point } from "diagram-js/lib/util/Types";
import { FONT } from "./styles.js";

export interface EndRoleChipLayout {
  /** The parent box around all chips of this end. */
  box: { x: number; y: number; width: number; height: number };
  center: Point;
  chipWidths: number[];
  chipHeight: number;
  innerWidth: number;
  gap: number;
}

export function endRoleChipLayout(
  endpoint: Point,
  toward: Point,
  direction: string,
  roles: string[],
): EndRoleChipLayout | null {
  if (roles.length === 0) return null;

  const dx = toward.x - endpoint.x;
  const dy = toward.y - endpoint.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const charW = FONT.small * 0.64;
  const letterDist = 11;

  const chipHeight = FONT.small + 6;
  const gap = 3;
  const pad = 4;
  const chipWidths = roles.map((role) => role.length * charW + 12);
  const innerWidth = chipWidths.reduce((a, b) => a + b, 0) + gap * (roles.length - 1);
  const width = innerWidth + pad * 2;
  const height = chipHeight + pad * 2;

  const dist = letterDist + (direction.length * charW) / 2 + 8 + width / 2;
  const center = { x: endpoint.x + ux * dist, y: endpoint.y + uy * dist };

  return {
    box: { x: center.x - width / 2, y: center.y - height / 2, width, height },
    center,
    chipWidths,
    chipHeight,
    innerWidth,
    gap,
  };
}
