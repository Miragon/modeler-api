/*! @miragon/modeler-shell icon geometry
 * Lucide (lucide-static 1.59.0) @license ISC
 * Copyright (c) 2026 Lucide Icons and Contributors
 * Derived from Feather, as Lucide's LICENSE lists them: check, circle-x (x-circle), maximize,
 * minus, plus, triangle-alert (alert-triangle) and x. Feather @license MIT
 * Copyright (c) 2013-present Cole Bemis
 * Full notices: THIRD_PARTY_NOTICES.md of @miragon/modeler-shell */

/*
 * The common Lucide set of the chrome (guide §5.14), inlined so the package has no icon runtime
 * dependency, copied unchanged from `icon-nodes.json`. One exception: `line-segment` (Draw) is
 * Lucide's `spline` with a straight segment between its end points, because the curve read as a
 * telephone receiver at 20px. The comment above is a legal comment, so
 * esbuild keeps it in the bundle chunk that carries this geometry.
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
  | "line-segment"
  | "unfold-horizontal"
  | "workflow";

export const ICONS: Readonly<Record<ShellIconName, IconNode>> = {
  menu: [
    ["path", { d: "M4 5h16" }],
    ["path", { d: "M4 12h16" }],
    ["path", { d: "M4 19h16" }],
  ],
  minus: [["path", { d: "M5 12h14" }]],
  plus: [
    ["path", { d: "M5 12h14" }],
    ["path", { d: "M12 5v14" }],
  ],
  maximize: [
    ["path", { d: "M8 3H5a2 2 0 0 0-2 2v3" }],
    ["path", { d: "M21 8V5a2 2 0 0 0-2-2h-3" }],
    ["path", { d: "M3 16v3a2 2 0 0 0 2 2h3" }],
    ["path", { d: "M16 21h3a2 2 0 0 0 2-2v-3" }],
  ],
  check: [["path", { d: "M20 6 9 17l-5-5" }]],
  x: [
    ["path", { d: "M18 6 6 18" }],
    ["path", { d: "m6 6 12 12" }],
  ],
  "file-plus": [
    [
      "path",
      {
        d: "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",
      },
    ],
    ["path", { d: "M14 2v5a1 1 0 0 0 1 1h5" }],
    ["path", { d: "M9 15h6" }],
    ["path", { d: "M12 18v-6" }],
  ],
  "folder-open": [
    [
      "path",
      {
        d: "m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2",
      },
    ],
  ],
  import: [
    ["path", { d: "M12 3v12" }],
    ["path", { d: "m8 11 4 4 4-4" }],
    ["path", { d: "M8 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4" }],
  ],
  "file-image": [
    [
      "path",
      {
        d: "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",
      },
    ],
    ["path", { d: "M14 2v5a1 1 0 0 0 1 1h5" }],
    ["circle", { cx: "10", cy: "12", r: "2" }],
    ["path", { d: "m20 17-1.296-1.296a2.41 2.41 0 0 0-3.408 0L9 22" }],
  ],
  "file-code-corner": [
    [
      "path",
      {
        d: "M4 12.15V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2h-3.35",
      },
    ],
    ["path", { d: "M14 2v5a1 1 0 0 0 1 1h5" }],
    ["path", { d: "m5 16-3 3 3 3" }],
    ["path", { d: "m9 22 3-3-3-3" }],
  ],
  keyboard: [
    ["path", { d: "M10 8h.01" }],
    ["path", { d: "M12 12h.01" }],
    ["path", { d: "M14 8h.01" }],
    ["path", { d: "M16 12h.01" }],
    ["path", { d: "M18 8h.01" }],
    ["path", { d: "M6 8h.01" }],
    ["path", { d: "M7 16h10" }],
    ["path", { d: "M8 12h.01" }],
    ["rect", { width: "20", height: "16", x: "2", y: "4", rx: "2" }],
  ],
  "share-2": [
    ["circle", { cx: "18", cy: "5", r: "3" }],
    ["circle", { cx: "6", cy: "12", r: "3" }],
    ["circle", { cx: "18", cy: "19", r: "3" }],
    ["line", { x1: "8.59", x2: "15.42", y1: "13.51", y2: "17.49" }],
    ["line", { x1: "15.41", x2: "8.59", y1: "6.51", y2: "10.49" }],
  ],
  "circle-x": [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "m15 9-6 6" }],
    ["path", { d: "m9 9 6 6" }],
  ],
  "triangle-alert": [
    ["path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" }],
    ["path", { d: "M12 9v4" }],
    ["path", { d: "M12 17h.01" }],
  ],
  "square-dashed-mouse-pointer": [
    [
      "path",
      {
        d: "M12.034 12.681a.498.498 0 0 1 .647-.647l9 3.5a.5.5 0 0 1-.033.943l-3.444 1.068a1 1 0 0 0-.66.66l-1.067 3.443a.5.5 0 0 1-.943.033z",
      },
    ],
    ["path", { d: "M5 3a2 2 0 0 0-2 2" }],
    ["path", { d: "M19 3a2 2 0 0 1 2 2" }],
    ["path", { d: "M5 21a2 2 0 0 1-2-2" }],
    ["path", { d: "M9 3h1" }],
    ["path", { d: "M9 21h2" }],
    ["path", { d: "M14 3h1" }],
    ["path", { d: "M3 9v1" }],
    ["path", { d: "M21 9v2" }],
    ["path", { d: "M3 14v1" }],
  ],
  hand: [
    ["path", { d: "M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" }],
    ["path", { d: "M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" }],
    ["path", { d: "M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" }],
    [
      "path",
      {
        d: "M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15",
      },
    ],
  ],
  "line-segment": [
    ["circle", { cx: "19", cy: "5", r: "2" }],
    ["circle", { cx: "5", cy: "19", r: "2" }],
    ["path", { d: "M6.5 17.5 17.5 6.5" }],
  ],
  "unfold-horizontal": [
    ["path", { d: "M16 12h6" }],
    ["path", { d: "M8 12H2" }],
    ["path", { d: "M12 2v2" }],
    ["path", { d: "M12 8v2" }],
    ["path", { d: "M12 14v2" }],
    ["path", { d: "M12 20v2" }],
    ["path", { d: "m19 15 3-3-3-3" }],
    ["path", { d: "m5 9-3 3 3 3" }],
  ],
  workflow: [
    ["rect", { width: "8", height: "8", x: "3", y: "3", rx: "2" }],
    ["path", { d: "M7 11v4a2 2 0 0 0 2 2h4" }],
    ["rect", { width: "8", height: "8", x: "13", y: "13", rx: "2" }],
  ],
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

const DEFAULT_SIZE = 16;
const DEFAULT_STROKE_WIDTH = 2.5;
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

// Everything Lucide icon nodes are made of. Markup goes into innerHTML (palette entry `html`), so
// any other element or attribute (a <script>, an onload, an href) is dropped.
const ICON_ELEMENTS: ReadonlySet<string> = new Set([
  "path",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "rect",
]);
const GEOMETRY_ATTRIBUTES: ReadonlySet<string> = new Set([
  "d",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "width",
  "height",
  "points",
]);

interface SanitizedIcon {
  root: [name: string, value: string][];
  children: [tag: string, attributes: [name: string, value: string][]][];
}

function positiveOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function iconNodeOf(icon: ShellIconName | IconNode): IconNode {
  if (typeof icon !== "string") return icon;
  return Object.prototype.hasOwnProperty.call(ICONS, icon) ? ICONS[icon] : [];
}

function sanitize(icon: ShellIconName | IconNode, options: IconOptions = {}): SanitizedIcon {
  const size = String(positiveOr(options.size, DEFAULT_SIZE));
  const root: SanitizedIcon["root"] = [];
  if (options.className) root.push(["class", options.className]);
  root.push(
    ["width", size],
    ["height", size],
    ["viewBox", "0 0 24 24"],
    ["fill", "none"],
    ["stroke", "currentColor"],
    ["stroke-width", String(positiveOr(options.strokeWidth, DEFAULT_STROKE_WIDTH))],
    ["stroke-linecap", "round"],
    ["stroke-linejoin", "round"],
    ["aria-hidden", "true"],
    ["focusable", "false"],
  );
  const children: SanitizedIcon["children"] = [];
  for (const node of iconNodeOf(icon)) {
    const [tag, attributes] = node;
    if (!ICON_ELEMENTS.has(tag)) continue;
    const kept = Object.entries(attributes)
      .filter(([name]) => GEOMETRY_ATTRIBUTES.has(name))
      .map(([name, value]): [string, string] => [name, String(value)]);
    children.push([tag, kept]);
  }
  return { root, children };
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function attributeList(attributes: readonly [string, string][]): string {
  return attributes.map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`).join("");
}

/**
 * Decorative inline SVG markup (`aria-hidden="true"`, `focusable="false"`, `fill="none"`,
 * `stroke="currentColor"`, round caps and joins). Only Lucide's elements and geometry attributes
 * pass, so the result is safe for `innerHTML` (palette entry `html`).
 */
export function iconMarkup(icon: ShellIconName | IconNode, options?: IconOptions): string {
  const { root, children } = sanitize(icon, options);
  const content = children.map(([tag, attributes]) => `<${tag}${attributeList(attributes)}/>`).join("");
  return `<svg xmlns="${SVG_NAMESPACE}"${attributeList(root)}>${content}</svg>`;
}

/** The same icon as an `SVGSVGElement`. */
export function iconElement(icon: ShellIconName | IconNode, options?: IconOptions): SVGSVGElement {
  const { root, children } = sanitize(icon, options);
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  for (const [name, value] of root) svg.setAttribute(name, value);
  for (const [tag, attributes] of children) {
    const child = document.createElementNS(SVG_NAMESPACE, tag);
    for (const [name, value] of attributes) child.setAttribute(name, value);
    svg.append(child);
  }
  return svg;
}
