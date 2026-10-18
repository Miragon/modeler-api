import {
  CHROME_ISLANDS,
  PALETTE_CLEARANCE,
  SHELL,
  type ChromeIsland,
  type PaletteRow,
  type ShellHost,
  type Size,
} from "../core/index.js";
import type { PageLike } from "./page.js";
import { inPage, type RelativeBox, type ToolWindow } from "./page-tools.js";

/** Every island box must match within this many pixels (guide §13.4). */
export const GEOMETRY_TOLERANCE_PX = 1;

/**
 * `getBoundingClientRect()` relative to the shell root's padding box, where its absolutely
 * positioned islands anchor (a border on the root, as in a framed foreign page, does not count).
 */
export interface IslandBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ChromeMeasurement {
  container: Size;
  /** From the root's `data-palette` attribute. */
  paletteRow: PaletteRow;
  /** The visible islands, found by `[data-chrome]`. */
  islands: Partial<Record<ChromeIsland, IslandBox>>;
  /** `[data-legend="open"]`, `[data-inspector="open"]`, `[data-problems="shown"]` on the root. */
  open: { legend: boolean; inspector: boolean; problems: boolean };
}

/** Constraints of one island; every given field must hold within `GEOMETRY_TOLERANCE_PX`. */
export interface ExpectedBox {
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
  width?: number;
  height?: number;
  /** Horizontal centre relative to the root. */
  centerX?: number;
}

export const DEFAULT_ROOT = ".cd-shell";

/** `[−] [NN%] [+] | [Fit]` with a 56px readout (guide §5.1, §5.8): 1+3+32+2+56+2+32+2+5+2+32+3+1. */
export const ZOOM_PANEL_WIDTH = 173;

/** Height of the web app's legal line under the bottom-left stack (guide §5.10). */
const LEGAL_LINE = 20;

/** Minimum width of the legend card (guide §5.10). */
const LEGEND_MIN_WIDTH = 184;

const STATUS_MAX_WIDTH = 560;
const DROPDOWN_MAX_WIDTH = 320;
const TOOLTIP_MAX_WIDTH = 280;
const SHEET_MAX_HEIGHT_SHARE = 0.45;

type MeasureResult = { error: string } | (ChromeMeasurement & { duplicates: string[] });

const measureProbe = ({ root, islands }: { root: string; islands: readonly string[] }): MeasureResult => {
  const tools = (window as ToolWindow).__modelerShellConformance!;
  const rootElement = document.querySelector<HTMLElement>(root);
  if (!rootElement) return { error: `no element matches the shell root selector "${root}"` };
  const boxes: Partial<Record<string, RelativeBox>> = {};
  const duplicates: string[] = [];
  for (const element of rootElement.querySelectorAll("[data-chrome]")) {
    const name = element.getAttribute("data-chrome") ?? "";
    if (!islands.includes(name) || !tools.visible(element)) continue;
    if (boxes[name]) {
      duplicates.push(name);
      continue;
    }
    boxes[name] = tools.box(element, rootElement);
  }
  return {
    container: tools.container(rootElement),
    paletteRow: rootElement.getAttribute("data-palette") === "second-row" ? "second-row" : "top",
    islands: boxes,
    open: {
      legend: rootElement.getAttribute("data-legend") === "open",
      inspector: rootElement.getAttribute("data-inspector") === "open",
      problems: rootElement.getAttribute("data-problems") === "shown",
    },
    duplicates,
  };
};

/** Measures the islands of the shell under `root` (default `.cd-shell`) in the page. */
export async function measureChrome(page: PageLike, root: string = DEFAULT_ROOT): Promise<ChromeMeasurement> {
  const result = await inPage(page, measureProbe, { root, islands: CHROME_ISLANDS });
  if ("error" in result) throw new Error(`@miragon/modeler-shell conformance: ${result.error}`);
  if (result.duplicates.length > 0) {
    const names = [...new Set(result.duplicates)].map((name) => `[data-chrome="${name}"]`).join(", ");
    throw new Error(`@miragon/modeler-shell conformance: more than one visible ${names}`);
  }
  return {
    container: result.container,
    paletteRow: result.paletteRow,
    islands: result.islands,
    open: result.open,
  };
}

/** Upper and lower limits the guide gives as "at least" and "at most" (guide §5.4 to §5.15). */
export interface BoxLimits {
  minWidth?: number;
  maxWidth?: number;
  maxHeight?: number;
  minLeft?: number;
  minRight?: number;
  minBottom?: number;
}

/** What the guide expects of the chrome in a measured state. */
export interface ChromeExpectations {
  boxes: Partial<Record<ChromeIsland, ExpectedBox>>;
  limits: Partial<Record<ChromeIsland, BoxLimits>>;
  /** Islands that must be visible. */
  required: ChromeIsland[];
  /** Islands that must not be visible, with the rule that hides them. */
  hidden: Partial<Record<ChromeIsland, string>>;
}

function isNarrow(container: Size): boolean {
  return container.width <= SHELL.narrow;
}

function isVeryNarrow(container: Size): boolean {
  return container.width <= SHELL.veryNarrow;
}

/** The open inspector is a bottom sheet up to `SHELL.narrow` (guide §5.11). */
function sheetOpen(measurement: ChromeMeasurement): boolean {
  return measurement.open.inspector && isNarrow(measurement.container);
}

/** The anchors and limits of guide §5.2 to §5.15 for `measurement` in `host`. */
export function chromeExpectations(measurement: ChromeMeasurement, host: ShellHost): ChromeExpectations {
  const { container, islands, open, paletteRow } = measurement;
  const { edge, gap, row, free, inspectorWidth } = SHELL;
  const web = host === "web";
  const secondRow = paletteRow === "second-row";
  const sheet = sheetOpen(measurement);
  const sideInspector = open.inspector && !isNarrow(container);
  const boxes: Partial<Record<ChromeIsland, ExpectedBox>> = {};
  const limits: Partial<Record<ChromeIsland, BoxLimits>> = {};
  const hidden: Partial<Record<ChromeIsland, string>> = {};
  const required: ChromeIsland[] = ["menu", "palette"];

  boxes.menu = { left: edge, top: edge, width: row, height: row };

  boxes.palette = { top: secondRow ? free : edge, height: row, centerX: container.width / 2 };
  const menu = islands.menu;
  limits.palette = secondRow
    ? { maxWidth: container.width - 2 * edge }
    : menu
      ? { minLeft: menu.left + menu.width + PALETTE_CLEARANCE }
      : {};

  if (sheet) {
    const reason = "hidden while the inspector is a bottom sheet (guide §5.11)";
    hidden.zoom = reason;
    hidden.problems = reason;
    hidden.legend = reason;
  } else {
    required.push("zoom");
    boxes.zoom = { right: edge, bottom: edge, width: ZOOM_PANEL_WIDTH, height: row };
    const stackBase = web ? edge + LEGAL_LINE + gap : edge;
    if (islands.problems) boxes.problems = { left: edge, bottom: stackBase, height: row };
    if (islands.legend) {
      const besidePill = open.problems ? stackBase + row + gap : stackBase;
      const bottom = isVeryNarrow(container) ? Math.max(besidePill, edge + row + gap) : besidePill;
      boxes.legend = { left: edge, bottom };
      limits.legend = { minWidth: LEGEND_MIN_WIDTH };
    }
  }

  if (islands.inspector) {
    if (sheet) {
      boxes.inspector = { left: edge, right: edge, bottom: edge };
      limits.inspector = { maxHeight: container.height * SHEET_MAX_HEIGHT_SHARE };
    } else {
      boxes.inspector = { top: free, right: edge, width: inspectorWidth };
      limits.inspector = { minBottom: free };
    }
  }

  if (islands.status) {
    const strip = sideInspector ? container.width - edge - inspectorWidth : container.width;
    boxes.status = { top: secondRow ? free + row + edge : free, centerX: strip / 2 };
    limits.status = {
      minLeft: edge,
      maxWidth: Math.min(STATUS_MAX_WIDTH, container.width - 2 * edge),
    };
  }

  if (web) {
    if (islands.primary) boxes.primary = { top: edge, right: edge, height: row };
  } else {
    hidden.primary = "the top right stays empty in IDE and embedded hosts (guide §5.7)";
  }

  return { boxes, limits, required, hidden };
}

/** The boxes guide §5.2–§5.12 expects for what was measured (anchors per host and breakpoint). */
export function expectedChromeBoxes(
  measurement: ChromeMeasurement,
  host: ShellHost,
): Partial<Record<ChromeIsland, ExpectedBox>> {
  return chromeExpectations(measurement, host).boxes;
}

const round = (value: number): number => Math.round(value * 10) / 10;

function sides(box: IslandBox, container: Size): Required<ExpectedBox> {
  return {
    left: box.left,
    top: box.top,
    right: container.width - box.left - box.width,
    bottom: container.height - box.top - box.height,
    width: box.width,
    height: box.height,
    centerX: box.left + box.width / 2,
  };
}

/** Every field of `expected` that `box` misses by more than `tolerance`, as readable problems. */
export function boxMismatches(
  name: string,
  box: IslandBox,
  expected: ExpectedBox,
  container: Size,
  tolerance: number = GEOMETRY_TOLERANCE_PX,
): string[] {
  const actual = sides(box, container);
  return (Object.keys(expected) as Array<keyof ExpectedBox>).flatMap((field) => {
    const want = expected[field];
    if (want === undefined) return [];
    const have = actual[field];
    return Math.abs(have - want) > tolerance + 1e-6
      ? [`${name}: ${field} is ${round(have)}px, expected ${round(want)}px (±${tolerance}px)`]
      : [];
  });
}

/** Every limit `box` breaks by more than `tolerance`. */
export function limitViolations(
  name: string,
  box: IslandBox,
  limits: BoxLimits,
  container: Size,
  tolerance: number = GEOMETRY_TOLERANCE_PX,
): string[] {
  const actual = sides(box, container);
  const problems: string[] = [];
  const atLeast = (field: string, have: number, limit: number | undefined) => {
    if (limit !== undefined && have < limit - tolerance - 1e-6) {
      problems.push(`${name}: ${field} is ${round(have)}px, at least ${round(limit)}px expected`);
    }
  };
  const atMost = (field: string, have: number, limit: number | undefined) => {
    if (limit !== undefined && have > limit + tolerance + 1e-6) {
      problems.push(`${name}: ${field} is ${round(have)}px, at most ${round(limit)}px expected`);
    }
  };
  atLeast("width", actual.width, limits.minWidth);
  atMost("width", actual.width, limits.maxWidth);
  atMost("height", actual.height, limits.maxHeight);
  atLeast("left", actual.left, limits.minLeft);
  atLeast("right", actual.right, limits.minRight);
  atLeast("bottom", actual.bottom, limits.minBottom);
  return problems;
}

/**
 * Every deviation of a measured state from guide §5.2 to §5.15: missing and unexpected islands,
 * boxes and limits, the palette row decision and the root's state attributes.
 */
export function geometryProblems(
  measurement: ChromeMeasurement,
  host: ShellHost,
  tolerance: number = GEOMETRY_TOLERANCE_PX,
): string[] {
  const { container, islands, open, paletteRow } = measurement;
  const expectations = chromeExpectations(measurement, host);
  const problems: string[] = [];
  const sheet = sheetOpen(measurement);

  for (const name of expectations.required) {
    if (!islands[name]) problems.push(`${name}: [data-chrome="${name}"] is missing or not visible`);
  }
  for (const name of CHROME_ISLANDS) {
    const box = islands[name];
    if (!box) continue;
    const expected = expectations.boxes[name];
    if (!expected) {
      const reason = expectations.hidden[name] ?? "no anchor of the guide applies";
      problems.push(`${name}: visible, but ${reason}`);
      continue;
    }
    problems.push(...boxMismatches(name, box, expected, container, tolerance));
    const limits = expectations.limits[name];
    if (limits) problems.push(...limitViolations(name, box, limits, container, tolerance));
  }

  if (isNarrow(container) && paletteRow !== "second-row") {
    problems.push(
      `palette: data-palette="${paletteRow}" in a ${round(container.width)}px wide container; up to ${SHELL.narrow}px it is "second-row" (guide §5.15)`,
    );
  }
  const palette = islands.palette;
  const menu = islands.menu;
  if (paletteRow === "second-row" && !isNarrow(container) && palette && menu) {
    const clipped = palette.width >= container.width - 2 * SHELL.edge - tolerance;
    const topRowLeft = (container.width - palette.width) / 2;
    if (!clipped && topRowLeft >= menu.left + menu.width + PALETTE_CLEARANCE + tolerance) {
      problems.push(
        `palette: in the second row although the top row keeps ${round(topRowLeft - menu.left - menu.width)}px to the menu trigger (at least ${PALETTE_CLEARANCE}px suffice, guide §5.15)`,
      );
    }
  }

  const state = (island: ChromeIsland, flag: boolean, attribute: string, hiddenBySheet: boolean) => {
    const shown = Boolean(islands[island]);
    if (flag && !shown && !hiddenBySheet) {
      problems.push(`${island}: the root carries ${attribute}, but the island is not visible`);
    }
    if (!flag && shown) problems.push(`${island}: visible, but the root lacks ${attribute}`);
  };
  state("problems", open.problems, 'data-problems="shown"', sheet);
  state("legend", open.legend, 'data-legend="open"', sheet);
  state("inspector", open.inspector, 'data-inspector="open"', false);

  return problems;
}

/** Where the dropdown opens (guide §5.4): under the trigger, at least 248px, inside the container. */
export function dropdownProblems(
  box: IslandBox,
  container: Size,
  tolerance = GEOMETRY_TOLERANCE_PX,
): string[] {
  const { edge, gap, row, menuMinWidth } = SHELL;
  return [
    ...boxMismatches("dropdown", box, { top: edge + row + gap, left: edge }, container, tolerance),
    ...limitViolations(
      "dropdown",
      box,
      {
        minWidth: menuMinWidth,
        maxWidth: Math.min(DROPDOWN_MAX_WIDTH, container.width - 2 * edge),
        minBottom: edge,
      },
      container,
      tolerance,
    ),
  ];
}

/** Which island a tooltip belongs to decides its row (guide §5.6). */
export type TooltipRow = "top" | "second-row" | "bottom";

/**
 * Where the chrome tooltip of a control stands (guide §5.6): 8px below the top row (`top: 60px`)
 * or the second row (`top: 112px`), 8px above the bottom row (`bottom: 60px`); centred on its
 * control and shifted to keep 12px to the sides.
 */
export function tooltipProblems(
  tooltip: IslandBox,
  anchor: IslandBox,
  row: TooltipRow,
  container: Size,
  tolerance = GEOMETRY_TOLERANCE_PX,
): string[] {
  const { edge, gap, row: rowHeight, free } = SHELL;
  const clamp = (centred: number) =>
    Math.max(edge, Math.min(centred, container.width - edge - tooltip.width));
  const expectedAt = (left: number): ExpectedBox =>
    row === "bottom"
      ? { left, bottom: edge + rowHeight + gap }
      : { left, top: (row === "top" ? edge : free) + rowHeight + gap };
  let mismatches = boxMismatches(
    "tooltip",
    tooltip,
    expectedAt(clamp(anchor.left + anchor.width / 2 - tooltip.width / 2)),
    container,
    tolerance,
  );
  // Guide §5.15 reads "mittig im Container" for the second row; until the guide settles whether
  // that means the container or the entry, either centre conforms.
  if (row === "second-row" && mismatches.length > 0) {
    const inContainer = boxMismatches(
      "tooltip",
      tooltip,
      expectedAt(clamp(container.width / 2 - tooltip.width / 2)),
      container,
      tolerance,
    );
    if (inContainer.length === 0) mismatches = inContainer;
  }
  return [
    ...mismatches,
    ...limitViolations(
      "tooltip",
      tooltip,
      { minLeft: edge, minRight: edge, maxWidth: Math.min(TOOLTIP_MAX_WIDTH, container.width - 2 * edge) },
      container,
      tolerance,
    ),
  ];
}
