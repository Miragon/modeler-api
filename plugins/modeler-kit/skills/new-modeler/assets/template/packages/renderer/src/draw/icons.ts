import { COLORS } from './styles.js';
import { lucideIcon, PALETTE_TOOL_ICON } from './lucide.js';

/** The palette shows what a creating entry creates: the shape as the canvas draws it (§5.5). */
const NODE_PREVIEW =
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" ` +
  `fill="${COLORS.fill}" stroke="${COLORS.ink}" stroke-width="1.5" aria-hidden="true" ` +
  `focusable="false"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/></svg>`;

export const ICONS = {
  lassoTool: lucideIcon('square-dashed-mouse-pointer', PALETTE_TOOL_ICON),
  handTool: lucideIcon('hand', PALETTE_TOOL_ICON),
  createNode: NODE_PREVIEW,
} as const;

/** No native `title`: the chrome's tooltip names the entry from `title` and `shortcut`. */
export function paletteEntryHtml(iconSvg: string, draggable = false): string {
  return `<div class="entry"${draggable ? ' draggable="true"' : ''}>${iconSvg}</div>`;
}
