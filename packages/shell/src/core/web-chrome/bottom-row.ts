import { SHELL } from "../sizes.js";

/**
 * Height of one line of the web app's legal line: 13px text on a 20px line (guide §5.10). Where a
 * narrow container cannot hold it in one line, it wraps (40 for two lines) and everything stacked
 * above it rises by as much: the pill, the legend, the raised zoom panel and the fit's bottom.
 */
export const LEGAL_LINE_HEIGHT = 20;

/** A measured legal line's height in whole lines, at least one: what the stack above it stands on. */
export function legalLineHeight(measured: number | undefined): number {
  if (measured === undefined || !Number.isFinite(measured) || measured <= 0)
    return LEGAL_LINE_HEIGHT;
  return Math.max(1, Math.round(measured / LEGAL_LINE_HEIGHT)) * LEGAL_LINE_HEIGHT;
}

export interface BottomRowInput {
  containerWidth: number;
  /** Measured right edge of the legal line relative to the shell root; absent while it is not shown. */
  legalRight?: number | undefined;
  /** Measured width of the zoom panel (173 with a 56px readout); absent while it is not shown. */
  zoomWidth?: number | undefined;
}

/**
 * Web app, bottom row: true when the zoom panel at `right: 12px` would keep less than
 * `SHELL.gap` (8px) to the legal line at `left: 12px`. The zoom panel then stands above the legal
 * line at `bottom: 40px` (12 + 20 + 8; a wrapped line lifts it further), like the pill
 * (`data-zoom-row="raised"` on the root), and the fit keeps 92px at the bottom (`FitLayout.zoomRaised`).
 * Guide §5.10 states this rule since design system 1.15.0 (Miragon/corporate-identity#37).
 * False when either of the two is not shown.
 */
export function zoomRowRaised(input: BottomRowInput): boolean {
  const { containerWidth, legalRight, zoomWidth } = input;
  if (legalRight === undefined || zoomWidth === undefined) return false;
  const zoomLeft = containerWidth - SHELL.edge - zoomWidth;
  return legalRight + SHELL.gap > zoomLeft;
}
