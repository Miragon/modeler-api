import type { ChromeIsland, PaletteRow, ShellHost, Size } from "../core/index.js";
import type { PageLike } from "./page.js";

/** Every island box must match within this many pixels (guide §13.4). */
export const GEOMETRY_TOLERANCE_PX = 1;

/** `getBoundingClientRect()` relative to the shell root. */
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

/** Measures the islands of the shell under `root` (default `.cd-shell`) in the page. */
export function measureChrome(page: PageLike, root?: string): Promise<ChromeMeasurement> {
  throw new Error("@miragon/modeler-shell: measureChrome is not implemented yet");
}

/** The boxes guide §5.2–§5.12 expects for what was measured (anchors per host and breakpoint). */
export function expectedChromeBoxes(
  measurement: ChromeMeasurement,
  host: ShellHost,
): Partial<Record<ChromeIsland, ExpectedBox>> {
  throw new Error("@miragon/modeler-shell: expectedChromeBoxes is not implemented yet");
}
