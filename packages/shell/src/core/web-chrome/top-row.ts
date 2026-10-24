import { PALETTE_CLEARANCE, decidePaletteRow } from "../layout.js";
import { SHELL } from "../sizes.js";
import type { PaletteRow } from "../types.js";

/** Border-box widths of the web app's primary action, measured with and without its label. */
export interface PrimaryWidths {
  /** Icon and label: padding `0 16px`, icon 16px, gap 8px, label 13px/600 (guide §5.7). */
  withLabel: number;
  /** The icon alone: `SHELL.row` (40) square. */
  iconOnly: number;
}

export interface TopRowInput {
  containerWidth: number;
  /** The palette's intrinsic border-box width, as for `decidePaletteRow`. */
  paletteWidth: number;
  /** Right edge of the menu trigger, relative to the shell root. */
  menuRight: number;
  /** The primary action at `right: 12px`; absent in IDE and embedded hosts and without one. */
  primary?: PrimaryWidths | undefined;
}

export interface TopRow {
  paletteRow: PaletteRow;
  /** `collapsed`: the primary action shows its icon only; its `aria-label` keeps the name. */
  primaryLabel: "shown" | "collapsed";
}

/**
 * The top row of guide §5.15 with a primary action: when it gets tight, the primary action loses
 * its label first, and only then the palette moves to the second row.
 *
 * 1. Without `primary`: `decidePaletteRow` alone, label `shown`.
 * 2. With the label (`primaryLeft = containerWidth − SHELL.edge − withLabel`): palette `top` →
 *    `{ top, shown }`.
 * 3. Icon only (`primaryLeft = containerWidth − SHELL.edge − iconOnly`): palette `top` →
 *    `{ top, collapsed }`.
 * 4. Otherwise the palette is in the second row and the top row holds only menu trigger and
 *    primary action: the label shows again when `menuRight + PALETTE_CLEARANCE` stays left of the
 *    labelled button, else it stays collapsed.
 *
 * Up to `SHELL.narrow` the palette is always in the second row (step 4).
 */
export function decideTopRow(input: TopRowInput): TopRow {
  const { containerWidth, paletteWidth, menuRight, primary } = input;
  if (!primary) {
    return {
      paletteRow: decidePaletteRow({ containerWidth, paletteWidth, menuRight }),
      primaryLabel: "shown",
    };
  }
  const paletteRowBeside = (primaryWidth: number): PaletteRow =>
    decidePaletteRow({
      containerWidth,
      paletteWidth,
      menuRight,
      primaryLeft: containerWidth - SHELL.edge - primaryWidth,
    });
  if (paletteRowBeside(primary.withLabel) === "top")
    return { paletteRow: "top", primaryLabel: "shown" };
  if (paletteRowBeside(primary.iconOnly) === "top")
    return { paletteRow: "top", primaryLabel: "collapsed" };
  const labelledLeft = containerWidth - SHELL.edge - primary.withLabel;
  return {
    paletteRow: "second-row",
    primaryLabel: menuRight + PALETTE_CLEARANCE <= labelledLeft ? "shown" : "collapsed",
  };
}
