import { hell } from '../theme/cd-tokens.generated.json';

/**
 * Canvas colours: the light roles of the vendored tokens (guide §10.1), written as SVG
 * presentation values, so an export looks the same everywhere and the drawing stays light until
 * the joint dark-mode release of the modelers. Never a hex literal of its own, never a var().
 */
export const COLORS = {
  ink: hell['--cd-ui-text'],
  fill: hell['--cd-ui-plot'],
  paper: hell['--cd-ui-grund'],
} as const;

/** SVG text does not inherit the container's font, so every label names the family (guide §4). */
export const FONT = {
  family: "'Geist Variable', 'Geist', ui-sans-serif, system-ui, sans-serif",
  size: 13,
  lineHeight: 1.25,
} as const;

export const STROKE_WIDTH = 2;
export const CORNER_RADIUS = 8;
export const LABEL_PADDING = 10;
