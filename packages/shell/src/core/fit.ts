import { SHELL } from "./sizes.js";
import type { Bounds, Insets, PaletteRow, ScaledViewbox, ShellHost, Size } from "./types.js";

/** Fit never zooms above 100 % (guide §5.9). */
export const MAX_FIT_ZOOM = 1;

/** Duration of the explicit, animated fit (`--cd-motion-base`). */
export const FIT_ANIMATION_MS = 250;

/**
 * The viewbox that shows `bounds` centred in the free rectangle (`container` minus `insets`) at the
 * largest scale that fits, capped at `maxZoom`. The box has the container's aspect ratio, so
 * diagram-js's `canvas.viewbox(box)` sets exactly this view. Returns `undefined` when the container
 * is 0 × 0 or `bounds` has neither width nor height; a zero width or height scales by the other
 * dimension. Where the insets leave no free room on an axis (a container lower or narrower than
 * its chrome), that axis centres in the whole container instead.
 */
export function fitViewbox(
  bounds: Bounds,
  container: Size,
  insets: Insets,
  maxZoom: number = MAX_FIT_ZOOM,
): ScaledViewbox | undefined {
  if (!(container.width > 0 && container.height > 0)) return undefined;
  const hasWidth = bounds.width > 0;
  const hasHeight = bounds.height > 0;
  if (!hasWidth && !hasHeight) return undefined;

  const horizontal = freeExtent(container.width, insets.left, insets.right);
  const vertical = freeExtent(container.height, insets.top, insets.bottom);
  const contentWidth = hasWidth ? bounds.width : 0;
  const contentHeight = hasHeight ? bounds.height : 0;
  const scale = Math.min(
    maxZoom,
    hasWidth ? horizontal.extent / contentWidth : Infinity,
    hasHeight ? vertical.extent / contentHeight : Infinity,
  );
  const box: ScaledViewbox = {
    x: bounds.x + contentWidth / 2 - (horizontal.start + horizontal.extent / 2) / scale,
    y: bounds.y + contentHeight / 2 - (vertical.start + vertical.extent / 2) / scale,
    width: container.width / scale,
    height: container.height / scale,
    scale,
  };
  return Object.values(box).every(Number.isFinite) && scale > 0 ? box : undefined;
}

function freeExtent(total: number, before: number, after: number): { start: number; extent: number } {
  const extent = total - before - after;
  return extent > 0 ? { start: before, extent } : { start: 0, extent: total };
}

/** What is open or shown when a fit runs (guide §5.9: every fit counts what is open right now). */
export interface FitLayout {
  container: Size;
  host: ShellHost;
  paletteRow: PaletteRow;
  /** The problems pill is shown (only the web app reserves room for it). */
  problemsVisible: boolean;
  /** Rendered width of the open legend; `undefined` when it is closed or the modeler has none. */
  legendWidth?: number | undefined;
  /**
   * The open inspector; `undefined` when closed. Above `SHELL.narrow` it is the side panel; up to it
   * a bottom sheet whose top edge (`sheetTop`, px from the container top) must be measured.
   */
  inspector?: { sheetTop?: number | undefined } | undefined;
}

/**
 * The fit insets of guide §5.9: top 88 (second row 140), sides 24, bottom 64 (web app with pill 92),
 * right 324 with an open side inspector, left 12 + legend width + 24 with an open legend above
 * `SHELL.veryNarrow`, bottom = distance to the sheet's top edge + 12 with an open bottom sheet.
 */
export function fitInsets(layout: FitLayout): Insets {
  const { container, host, paletteRow, problemsVisible, legendWidth, inspector } = layout;
  const insets: Insets = {
    top: paletteRow === "second-row" ? SHELL.fitInsetTopSecondRow : SHELL.fitInsetTop,
    right: SHELL.fitInsetSide,
    bottom: host === "web" && problemsVisible ? SHELL.fitInsetBottomWeb : SHELL.fitInsetBottom,
    left: SHELL.fitInsetSide,
  };

  const bottomSheetOpen = inspector !== undefined && container.width <= SHELL.narrow;
  if (inspector !== undefined && !bottomSheetOpen) {
    insets.right = SHELL.edge + SHELL.inspectorWidth + SHELL.fitInsetSide;
  }
  if (bottomSheetOpen) {
    // Guide §5.11: the sheet hides zoom panel, pill and legend, so only the sheet itself counts.
    insets.bottom =
      inspector.sheetTop === undefined
        ? SHELL.fitInsetBottom
        : container.height - inspector.sheetTop + SHELL.edge;
  } else if (legendWidth !== undefined && legendWidth > 0 && container.width > SHELL.veryNarrow) {
    insets.left = SHELL.edge + legendWidth + SHELL.fitInsetSide;
  }
  return insets;
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
  const close = (first: number, second: number): boolean =>
    Math.abs(first - second) <= tolerance * Math.max(1, Math.abs(first), Math.abs(second));
  return (
    close(a.scale, b.scale) && close(a.x * a.scale, b.x * b.scale) && close(a.y * a.scale, b.y * b.scale)
  );
}

/**
 * The view at `progress` (0…1) between two viewboxes of the same container: the scale is
 * interpolated in log space, the centre linearly. Used per animation frame by the animated fit.
 */
export function interpolateViewbox(from: ScaledViewbox, to: ScaledViewbox, progress: number): ScaledViewbox {
  if (!(progress > 0)) return { ...from };
  if (progress >= 1) return { ...to };
  const linear = (start: number, end: number): number => start + (end - start) * progress;
  const scale =
    from.scale > 0 && to.scale > 0
      ? Math.exp(linear(Math.log(from.scale), Math.log(to.scale)))
      : linear(from.scale, to.scale);
  const centreX = linear(from.x + from.width / 2, to.x + to.width / 2);
  const centreY = linear(from.y + from.height / 2, to.y + to.height / 2);
  const width = linear(from.width * from.scale, to.width * to.scale) / scale;
  const height = linear(from.height * from.scale, to.height * to.scale) / scale;
  return { x: centreX - width / 2, y: centreY - height / 2, width, height, scale };
}

/** `--cd-ease`, `cubic-bezier(0.4, 0, 0.2, 1)`, as a function of time 0…1. */
export function easeStandard(progress: number): number {
  return STANDARD_EASING(progress);
}

const STANDARD_EASING = cubicBezier(0.4, 0, 0.2, 1);

/** A CSS `cubic-bezier(x1, y1, x2, y2)` timing function (`x1`, `x2` within 0…1, so x(t) is monotone). */
function cubicBezier(x1: number, y1: number, x2: number, y2: number): (progress: number) => number {
  const polynomial = (first: number, second: number) => {
    const c = 3 * first;
    const b = 3 * (second - first) - c;
    const a = 1 - c - b;
    return {
      at: (t: number): number => ((a * t + b) * t + c) * t,
      slope: (t: number): number => (3 * a * t + 2 * b) * t + c,
    };
  };
  const curveX = polynomial(x1, x2);
  const curveY = polynomial(y1, y2);
  const precision = 1e-7;

  const parameterFor = (x: number): number => {
    let t = x;
    for (let iteration = 0; iteration < 8; iteration++) {
      const error = curveX.at(t) - x;
      if (Math.abs(error) < precision) return t;
      const slope = curveX.slope(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= error / slope;
      if (t < 0 || t > 1) break;
    }
    // Newton left the curve or stalled on a flat stretch: bisection always converges.
    let low = 0;
    let high = 1;
    t = x;
    for (let iteration = 0; iteration < 60; iteration++) {
      const value = curveX.at(t);
      if (Math.abs(value - x) < precision) break;
      if (value < x) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return t;
  };

  return (progress) => {
    if (!(progress > 0)) return 0;
    if (progress >= 1) return 1;
    return curveY.at(parameterFor(progress));
  };
}
