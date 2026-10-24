import { fest, hell } from "../theme/cd-tokens.generated.json";

/**
 * Canvas colours, the light roles of the vendored design tokens (guide §10.1): contours,
 * connections and labels in the text role, element fills in the plot role. The renderer writes
 * them as presentation values, so exports look the same everywhere and stay light in every mode.
 */
export const COLORS = {
  ink: hell["--cd-ui-text"],
  fill: hell["--cd-ui-plot"],
} as const;

/**
 * The family goes onto every SVG text node, since SVG text does not inherit the container's font
 * (guide §4). "Geist Variable" is the name `@fontsource-variable/geist` registers; the hosts load
 * it, and an exported SVG opened elsewhere falls back to "Geist" or a system sans.
 */
export const FONT = {
  family: "'Geist Variable', 'Geist', ui-sans-serif, system-ui, sans-serif",
  size: 12,
  lineHeight: 1.2,
} as const;

export const STROKE_WIDTH = 2;

export const LABEL_PADDING = 7;

/**
 * The halo a label on a shape's own fill carries in that fill (guide §10.1, label halo): 1.5px
 * around every glyph, so label lines past the shape stay readable on whatever lies there.
 */
export const LABEL_HALO_WIDTH = 3;

/**
 * The colour picker (guide §10.6): "Default" stores no colour and follows the roles, then the
 * palette and the status colours as fill colours, each once (success is gruen, info is blau).
 * Blau-link and blau-hell are the link and focus tones of blau, no fill colours (guide §3.1).
 * White is a fixed fill: it looks like Default on the light canvas, not once Default follows a
 * dark plot.
 */
export const COLOR_OPTIONS: ReadonlyArray<{ label: string; color?: string }> = [
  { label: "Default" },
  { label: "Blue", color: fest["--cd-blau"] },
  { label: "Green", color: fest["--cd-gruen"] },
  { label: "Gray", color: fest["--cd-grau"] },
  { label: "Black", color: fest["--cd-schwarz"] },
  { label: "White", color: fest["--cd-weiss"] },
  { label: "Amber", color: fest["--cd-warning"] },
  { label: "Red", color: fest["--cd-danger"] },
];

/** Label colours on a fill of the shape's own (guide §10.6), whichever contrasts more. */
export const LABEL_ON_FILL = {
  dark: fest["--cd-schwarz"],
  light: fest["--cd-weiss"],
} as const;
