/** The severity of one problem; the pill and the list show `circle-x` or `triangle-alert` (guide §5.10). */
export type ProblemSeverity = "error" | "warning";

/** One row of the web app's problems list (guide §5.10). */
export interface ProblemItem {
  severity: ProblemSeverity;
  /** 13px `--cd-ui-text`: "Unknown sticky type “evnt”." */
  message: string;
  /** The place in 13px `--cd-ui-text-leise` below the message: "Line 12", "“Order Placed”". */
  location?: string | undefined;
  /** The diagram element a click on the row selects (`ProblemsOptions.onSelectItem`). */
  elementId?: string | undefined;
}

/** `ShellHandle.setProblems` input built from the items: count, errors and the items themselves. */
export function problemSummary(items: readonly ProblemItem[]): {
  count: number;
  errors: number;
  items: readonly ProblemItem[];
} {
  // TODO(feedback): errors = items with severity "error".
  return { count: items.length, errors: 0, items };
}
