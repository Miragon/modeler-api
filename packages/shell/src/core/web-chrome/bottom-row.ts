import { SHELL } from "../sizes.js";

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
 * line at `bottom: 40px` (12 + 20 + 8), like the pill (`data-zoom-row="raised"` on the root), and
 * the fit keeps 92px at the bottom (`FitLayout.zoomRaised`). Guide §5.10 and §5.15 do not settle
 * this collision of a narrow container; it is the shell's rule until they do.
 * False when either of the two is not shown.
 */
export function zoomRowRaised(input: BottomRowInput): boolean {
  const { containerWidth, legalRight, zoomWidth } = input;
  if (legalRight === undefined || zoomWidth === undefined) return false;
  const zoomLeft = containerWidth - SHELL.edge - zoomWidth;
  return legalRight + SHELL.gap > zoomLeft;
}
