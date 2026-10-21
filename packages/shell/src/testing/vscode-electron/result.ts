import type { Appearance, ChromeIsland } from "../../core/index.js";
import { describeAppearance, type VsCodeColorTheme } from "./themes.js";

/** The steps of a run, in order; `total` spans all of them. */
export const VSCODE_SMOKE_STEPS = [
  "resolve",
  "launch",
  "open",
  "edit",
  "save",
  "undo",
  "themes",
  "close",
] as const;

export type VsCodeSmokeStep = (typeof VSCODE_SMOKE_STEPS)[number];

/** Milliseconds per step; a step that did not run is missing. */
export type VsCodeSmokeTimings = Partial<Record<VsCodeSmokeStep | "total", number>>;

/** Whether each checked island of the shell's chrome was visible. */
export type ChromePresence = Partial<Record<ChromeIsland, boolean>>;

export interface VsCodeSmokeThemeResult {
  theme: VsCodeColorTheme;
  /** What the theme bridge has to show for the modeler's `themes`. */
  expected: Appearance;
  /** What the webview's `<html>` showed once the workbench had switched; missing when it never did. */
  observed?: Appearance | undefined;
  /** The webview's `<body>` theme classes VS Code set. */
  bodyClasses: readonly string[];
  chrome: ChromePresence;
  /** The screenshot of the window, when a `screenshotDir` was given and the theme switched. */
  screenshot?: string | undefined;
  ms: number;
  ok: boolean;
}

export interface VsCodeSmokeResult {
  /** No failure. */
  ok: boolean;
  /** Every broken expectation, prefixed with its step (`save: …`). */
  failures: string[];
  /** The VS Code version that ran. */
  vscodeVersion?: string | undefined;
  executablePath?: string | undefined;
  /** `publisher.name` of the modeler's extension. */
  extensionId?: string | undefined;
  viewType?: string | undefined;
  /** The chrome once the fixture had opened. */
  chrome: ChromePresence;
  /** The text the save wrote and what `parse` returned for it. */
  saved?: { text: string; parsed: unknown } | undefined;
  /** Undo brought back the canvas and, saved again, the fixture's exact text. */
  undone: boolean;
  themes: VsCodeSmokeThemeResult[];
  timings: VsCodeSmokeTimings;
}

/** Collects failures per step while a run goes on. */
export class SmokeFailures {
  readonly list: string[] = [];

  add(step: VsCodeSmokeStep, message: string): void {
    this.list.push(`${step}: ${message}`);
  }

  has(step: VsCodeSmokeStep): boolean {
    return this.list.some((failure) => failure.startsWith(`${step}: `));
  }
}

/** The islands of `expected` that were not visible, as a failure text; undefined when all were. */
export function missingChrome(expected: readonly ChromeIsland[], chrome: ChromePresence): string | undefined {
  const missing = expected.filter((island) => chrome[island] !== true);
  if (missing.length === 0) return undefined;
  return `the shell's chrome is incomplete: ${missing.map((island) => `[data-chrome="${island}"]`).join(", ")} not visible`;
}

/** Whether the webview shows `expected`, both attributes. */
export function sameAppearance(expected: Appearance, observed: Appearance | undefined): boolean {
  return (
    observed !== undefined && observed.theme === expected.theme && observed.kontrast === expected.kontrast
  );
}

/** The screenshot file of a theme: `<name>-<theme id>.png`. */
export function screenshotFileName(name: string, theme: VsCodeColorTheme): string {
  return `${name.replace(/[^\w.-]+/g, "-")}-${theme.id}.png`;
}

function seconds(ms: number | undefined): string {
  return ms === undefined ? "–" : `${(ms / 1000).toFixed(1)} s`;
}

/** A few lines for the test log: version, timings, every theme and the failures. */
export function formatVsCodeSmoke(result: VsCodeSmokeResult): string {
  const head = [
    `VS Code ${result.vscodeVersion ?? "(not resolved)"}`,
    result.extensionId ?? "(unknown extension)",
    result.viewType ?? "(no custom editor)",
    result.ok ? "ok" : `${result.failures.length} failure${result.failures.length === 1 ? "" : "s"}`,
  ].join(" · ");
  const timings = [...VSCODE_SMOKE_STEPS, "total" as const]
    .filter((step) => result.timings[step] !== undefined)
    .map((step) => `${step} ${seconds(result.timings[step])}`)
    .join(" · ");
  const themes = result.themes.map(
    (entry) =>
      `  ${entry.ok ? "ok    " : "FAILED"} ${entry.theme.name}: ${describeAppearance(entry.observed)}` +
      ` (expected ${describeAppearance(entry.expected)}), ${seconds(entry.ms)}` +
      (entry.screenshot ? `, ${entry.screenshot}` : ""),
  );
  const failures = result.failures.map((failure) => `  - ${failure}`);
  return [head, timings, ...themes, ...(failures.length > 0 ? ["failures:", ...failures] : [])].join("\n");
}
