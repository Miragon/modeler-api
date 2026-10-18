/**
 * The common Lucide set of the chrome (guide §5.14), inlined so the package has no icon runtime
 * dependency. Copied unchanged from lucide-static 1.59.0 (ISC, © Lucide Icons and Contributors;
 * see THIRD_PARTY_NOTICES.md).
 */

/** One Lucide icon: its SVG child elements on the 24 × 24 grid. */
export type IconNode = ReadonlyArray<readonly [tag: string, attributes: Readonly<Record<string, string>>]>;

export type ShellIconName =
  | "menu"
  | "minus"
  | "plus"
  | "maximize"
  | "check"
  | "x"
  | "file-plus"
  | "folder-open"
  | "import"
  | "file-image"
  | "file-code-corner"
  | "keyboard"
  | "share-2"
  | "circle-x"
  | "triangle-alert"
  | "square-dashed-mouse-pointer"
  | "hand"
  | "spline"
  | "unfold-horizontal"
  | "workflow";

export const ICONS: Readonly<Record<ShellIconName, IconNode>> = {
  menu: [],
  minus: [],
  plus: [],
  maximize: [],
  check: [],
  x: [],
  "file-plus": [],
  "folder-open": [],
  import: [],
  "file-image": [],
  "file-code-corner": [],
  keyboard: [],
  "share-2": [],
  "circle-x": [],
  "triangle-alert": [],
  "square-dashed-mouse-pointer": [],
  hand: [],
  spline: [],
  "unfold-horizontal": [],
  workflow: [],
};

export interface IconOptions {
  /** Rendered width and height in px; default 16 (chrome). */
  size?: number;
  /** Stroke width on the 24 grid; default 2.5. */
  strokeWidth?: number;
  className?: string;
}

/** Palette tool icons: 20px with stroke 2 (guide §5.5), as heavy as the 16px chrome icons. */
export const PALETTE_TOOL_ICON: Readonly<IconOptions> = { size: 20, strokeWidth: 2 };

/**
 * Decorative inline SVG markup (`aria-hidden="true"`, `focusable="false"`, `fill="none"`,
 * `stroke="currentColor"`, round caps and joins). Only Lucide's elements and geometry attributes
 * pass, so the result is safe for `innerHTML` (palette entry `html`).
 */
export function iconMarkup(icon: ShellIconName | IconNode, options?: IconOptions): string {
  throw new Error("@miragon/modeler-shell: iconMarkup is not implemented yet");
}

/** The same icon as an `SVGSVGElement`. */
export function iconElement(icon: ShellIconName | IconNode, options?: IconOptions): SVGSVGElement {
  throw new Error("@miragon/modeler-shell: iconElement is not implemented yet");
}
