/**
 * Every text the shell shows or announces, in one table (guide §2, shared terms). English by
 * default; a localized modeler overrides the whole table in its language, numbers arrive already
 * formatted through `Intl` in that language.
 */
export interface ShellMessages {
  /** Menu trigger `aria-label` and tooltip, dropdown `aria-label`. */
  menu: string;
  /** Palette `aria-label`. */
  tools: string;
  /** Zoom panel `aria-label`. */
  zoom: string;
  zoomOut: string;
  zoomIn: string;
  /** Tooltip of the readout, e.g. `(percent) => "Zoom to " + percent` with percent "100%". */
  zoomToActual(percent: string): string;
  /** `aria-label` of the readout: "Zoom to 100% (now 86%)". */
  zoomToActualNow(percent: string, now: string): string;
  fit: string;
  /** Legend title and the Model-group checkbox. */
  legend: string;
  closeLegend: string;
  /** Pill text: "1 problem", "2 problems". */
  problems(count: number, formattedCount: string): string;
  /** Pill `aria-label`: "2 problems, 1 error", "2 problems, no errors". */
  problemsLabel(count: number, errors: number, formattedCount: string, formattedErrors: string): string;
  /** Pill tooltip in the IDE host. */
  showProblems: string;
  /** Empty-file hint (guide §13.5). */
  emptyHint: string;
  insertExample: string;
  /** Status box for an invalid file; `diagram` names the notation ("Event Storming board"). */
  invalidFile(diagram: string): string;
  /** Key names in shortcut chips outside macOS (German: Strg, Umschalt, Plus, Minus). */
  keyNames: { ctrl: string; shift: string; plus: string; minus: string };
}

export type ShellMessageOverrides = Partial<Omit<ShellMessages, "keyNames">> & {
  keyNames?: Partial<ShellMessages["keyNames"]>;
};

export const defaultMessages: ShellMessages = {
  menu: "Menu",
  tools: "Tools",
  zoom: "Zoom",
  zoomOut: "Zoom out",
  zoomIn: "Zoom in",
  zoomToActual: (percent) => `Zoom to ${percent}`,
  zoomToActualNow: (percent, now) => `Zoom to ${percent} (now ${now})`,
  fit: "Fit to view",
  legend: "Legend",
  closeLegend: "Close legend",
  problems: (count, formattedCount) => `${formattedCount} ${count === 1 ? "problem" : "problems"}`,
  problemsLabel: (count, errors, formattedCount, formattedErrors) =>
    `${formattedCount} ${count === 1 ? "problem" : "problems"}, ${
      errors === 0 ? "no errors" : `${formattedErrors} ${errors === 1 ? "error" : "errors"}`
    }`,
  showProblems: "Show in Problems view",
  emptyHint: "Pick a tool from the palette to start.",
  insertExample: "Insert example",
  invalidFile: (diagram) =>
    `This file isn't a valid ${diagram} right now. The diagram shows the last valid version and is read-only until you fix the text.`,
  keyNames: { ctrl: "Ctrl", shift: "Shift", plus: "Plus", minus: "Minus" },
};

/** `defaultMessages` with `overrides` applied (`keyNames` merged key by key). */
export function resolveMessages(overrides?: ShellMessageOverrides): ShellMessages {
  throw new Error("@miragon/modeler-shell: resolveMessages is not implemented yet");
}
