/**
 * The sizes of the design system's `shell` tokens that the renderer's own chrome needs, for hosts
 * without the modeler shell: the values of `cd-tokens.generated.json` (`test/theme.sync.test.ts`
 * fails when one drifts). Pure data — no DOM, no imports.
 */

/** Guide §5.10: up to these container sizes a legend without a stored state starts closed. */
export const LEGEND_CLOSED_UP_TO = {
  /** `--cd-shell-sehr-schmal` */
  width: 440,
  /** `--cd-shell-niedrig` */
  height: 820,
} as const;
