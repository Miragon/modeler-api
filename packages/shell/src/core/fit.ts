import type { Bounds, Insets, PaletteRow, ScaledViewbox, ShellHost, Size } from "./types.js";

/** Fit never zooms above 100 % (guide §5.9). */
export const MAX_FIT_ZOOM = 1;

/** Duration of the explicit, animated fit (`--cd-motion-base`). */
export const FIT_ANIMATION_MS = 250;

/**
 * The viewbox that shows `bounds` centred in the free rectangle (`container` minus `insets`) at the
 * largest scale that fits, capped at `maxZoom`. The box has the container's aspect ratio, so
 * diagram-js's `canvas.viewbox(box)` sets exactly this view. Returns `undefined` when the container
 * is 0 × 0 or `bounds` has neither width nor height.
 */
export function fitViewbox(
  bounds: Bounds,
  container: Size,
  insets: Insets,
  maxZoom: number = MAX_FIT_ZOOM,
): ScaledViewbox | undefined {
  throw new Error("@miragon/modeler-shell: fitViewbox is not implemented yet");
}

/** What is open or shown when a fit runs (guide §5.9: every fit counts what is open right now). */
export interface FitLayout {
  container: Size;
  host: ShellHost;
  paletteRow: PaletteRow;
  /** The problems pill is shown (only the web app reserves room for it). */
  problemsVisible: boolean;
  /** Rendered width of the open legend; `undefined` when it is closed or the modeler has none. */
  legendWidth?: number;
  /**
   * The open inspector; `undefined` when closed. Above `SHELL.narrow` it is the side panel; up to it
   * a bottom sheet whose top edge (`sheetTop`, px from the container top) must be measured.
   */
  inspector?: { sheetTop?: number };
}

/**
 * The fit insets of guide §5.9: top 88 (second row 140), sides 24, bottom 64 (web app with pill 92),
 * right 324 with an open side inspector, left 12 + legend width + 24 with an open legend above
 * `SHELL.veryNarrow`, bottom = distance to the sheet's top edge + 12 with an open bottom sheet.
 */
export function fitInsets(layout: FitLayout): Insets {
  throw new Error("@miragon/modeler-shell: fitInsets is not implemented yet");
}

/** Relative tolerance of `sameView` (diagram-js rounds the transform to three decimals). */
export const VIEW_TOLERANCE = 1e-3;

/**
 * True when two views are the same within `tolerance`: the scale and the translation in screen
 * pixels (`x · scale`, `y · scale`) agree relative to `max(1, |value|)`. Width and height are
 * ignored, so a container resize is never a difference.
 */
export function sameView(
  a: Pick<ScaledViewbox, "x" | "y" | "scale">,
  b: Pick<ScaledViewbox, "x" | "y" | "scale">,
  tolerance: number = VIEW_TOLERANCE,
): boolean {
  throw new Error("@miragon/modeler-shell: sameView is not implemented yet");
}

/**
 * The view at `progress` (0…1) between two viewboxes of the same container: the scale is
 * interpolated in log space, the centre linearly. Used per animation frame by the animated fit.
 */
export function interpolateViewbox(from: ScaledViewbox, to: ScaledViewbox, progress: number): ScaledViewbox {
  throw new Error("@miragon/modeler-shell: interpolateViewbox is not implemented yet");
}

/** `--cd-ease`, `cubic-bezier(0.4, 0, 0.2, 1)`, as a function of time 0…1. */
export function easeStandard(progress: number): number {
  throw new Error("@miragon/modeler-shell: easeStandard is not implemented yet");
}
