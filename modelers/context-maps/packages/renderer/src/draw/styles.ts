/**
 * Shared rendering constants (typography, accent, priorities) — Miragon corporate identity.
 *  Colours are derived from the single source of truth in `theme/palette.ts` (`MIRAGON`), which
 *  mirrors the vendored `--cd-*` brand tokens.
 */

import { MIRAGON } from "../theme/index.js";

/** BaseRenderer default priority is 1000; 1500 wins the render.shape/connection event. */
export const TT_RENDER_PRIORITY = 1500;

/** Selection / hover accent (Miragon blue — kept in sync with the app theme via the shared palette). */
export const ACCENT = MIRAGON.blau;

export const INK = MIRAGON.schwarz;
/** Secondary text (the team caption): at least 4.5:1 on white, grau and every subdomain fill. */
export const INK_SOFT = MIRAGON.textLeise;

export const FONT = {
  /**
   * Set directly as the `font-family` attribute on every SVG <text> (canvas
   * labels and therefore the SVG export too) — not inherited from a CSS
   * container. Prefers the self-hosted Miragon typeface Geist (registered as
   * 'Geist Variable' by @fontsource-variable/geist, with 'Geist' as a fallback
   * name), and falls back to a system sans when the host hasn't loaded it (e.g.
   * an exported SVG opened standalone).
   */
  family:
    "'Geist Variable', 'Geist', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  label: 13.5,
  small: 11,
} as const;

/**
 * Fixed top offset (px at zoom 1) of a context's name inside its box: the
 * first line starts here, right below the subdomain-type header, so the gap
 * between header and name never varies with box size or line count.
 */
export const CONTEXT_NAME_TOP = 36;

/** Height (px at zoom 1) reserved at the box bottom for the team caption. */
export const CONTEXT_TEAM_RESERVE = 18;

/** Paper colour used for the label halo so text stays legible over lines. */
export const PAPER = MIRAGON.weiss;

/**
 * Box colours for contexts without a subdomain classification (canvas + icons): the element fill
 * of guide §10.1 and a contour that keeps 3:1 against the canvas around it.
 */
export const NEUTRAL_FILL = MIRAGON.weiss;
export const NEUTRAL_STROKE = MIRAGON.kontur;
