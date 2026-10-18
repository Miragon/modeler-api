import type { Bounds, PaletteRow, Point, Size } from "./types.js";

/** Free space the top row needs between the palette and a neighbouring island (guide §5.15). */
export const PALETTE_CLEARANCE = 16;

/** Hover delay of the chrome tooltip, equal to diagram-js `HoverTooltip` `SHOW_DELAY`. */
export const TOOLTIP_DELAY_MS = 300;

/** The status box for an invalid file shows after this long without a valid import (guide §5.12). */
export const INVALID_STATUS_DELAY_MS = 800;

export interface PaletteRowInput {
  containerWidth: number;
  /** The palette's intrinsic width (`scrollWidth`), so the decision does not flip once it moved. */
  paletteWidth: number;
  /** Right edge of the menu trigger, relative to the shell root. */
  menuRight: number;
  /** Left edge of the primary action (web app), relative to the shell root; absent in IDE hosts. */
  primaryLeft?: number;
}

/**
 * `second-row` when the container is at most `SHELL.narrow` wide or a centred palette would keep
 * less than `PALETTE_CLEARANCE` to the menu trigger (or the primary action); `top` otherwise.
 */
export function decidePaletteRow(input: PaletteRowInput): PaletteRow {
  throw new Error("@miragon/modeler-shell: decidePaletteRow is not implemented yet");
}

/** The legend starts open unless the container is at most `SHELL.low` high (guide §5.10). */
export function legendStartsOpen(containerHeight: number): boolean {
  throw new Error("@miragon/modeler-shell: legendStartsOpen is not implemented yet");
}

export interface TooltipPlacementInput {
  /** The hovered or focused control, relative to the shell root (horizontal centre). */
  anchor: Bounds;
  /** The island the control sits in, relative to the shell root (vertical placement). */
  island: Bounds;
  tooltip: Size;
  container: Size;
}

/**
 * The tooltip's top-left corner relative to the shell root (guide §5.6): below an island in the
 * upper half (`island.bottom + 8`: top row 60, second row 112), above one in the lower half
 * (`island.top − 8 − height`: bottom row ends at `bottom: 60px`); centred on the anchor, shifted to
 * keep `SHELL.edge` to the container's sides.
 */
export function placeTooltip(input: TooltipPlacementInput): Point {
  throw new Error("@miragon/modeler-shell: placeTooltip is not implemented yet");
}
