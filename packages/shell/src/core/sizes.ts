/**
 * The shell dimensions of the design system (guide §5.1, `shell` group of
 * `cd-tokens.generated.json`), keyed by a readable name. Scripts use `SHELL`; CSS uses the
 * `var(--cd-shell-*)` variables the consumer vendors. A drift test pins `SHELL` to the token JSON.
 */
export const SHELL_TOKENS = {
  edge: "--cd-shell-rand",
  gap: "--cd-shell-luecke",
  row: "--cd-shell-zeile",
  target: "--cd-shell-ziel",
  entry: "--cd-shell-eintrag",
  free: "--cd-shell-frei",
  menuMinWidth: "--cd-shell-menue-breite",
  inspectorWidth: "--cd-shell-inspector-breite",
  fitInsetTop: "--cd-shell-einpassen-oben",
  fitInsetTopSecondRow: "--cd-shell-einpassen-oben-schmal",
  fitInsetSide: "--cd-shell-einpassen-seite",
  fitInsetBottom: "--cd-shell-einpassen-unten",
  fitInsetBottomWeb: "--cd-shell-einpassen-unten-web",
  narrow: "--cd-shell-schmal",
  veryNarrow: "--cd-shell-sehr-schmal",
  low: "--cd-shell-niedrig",
  layerIslands: "--cd-shell-ebene-inseln",
  layerInspector: "--cd-shell-ebene-inspector",
  layerTopRow: "--cd-shell-ebene-reihe",
  layerPopups: "--cd-shell-ebene-aufklapper",
  layerDialog: "--cd-shell-ebene-dialog",
  layerToast: "--cd-shell-ebene-toast",
} as const;

export type ShellSizeName = keyof typeof SHELL_TOKENS;

export type ShellSizes = Readonly<Record<ShellSizeName, number>>;

/** Pixels (layers: plain z-index numbers), equal to `parseFloat` of the token JSON values. */
export const SHELL: ShellSizes = {
  edge: 12,
  gap: 8,
  row: 40,
  target: 32,
  entry: 36,
  free: 64,
  menuMinWidth: 248,
  inspectorWidth: 288,
  fitInsetTop: 88,
  fitInsetTopSecondRow: 140,
  fitInsetSide: 24,
  fitInsetBottom: 64,
  fitInsetBottomWeb: 92,
  narrow: 760,
  veryNarrow: 440,
  low: 820,
  layerIslands: 20,
  layerInspector: 25,
  layerTopRow: 30,
  layerPopups: 40,
  layerDialog: 50,
  layerToast: 60,
};

// Shell sizes are pixels ("12px") or plain z-index numbers ("20"); any other unit would make
// parseFloat silently return a number with the wrong meaning.
const PIXEL_OR_PLAIN_NUMBER = /^\s*-?(?:\d+(?:\.\d*)?|\.\d+)(?:px)?\s*$/;

/**
 * Reads the `shell` group of `cd-tokens.generated.json` (`{ "--cd-shell-rand": "12px", … }`) into
 * numbers. Throws when a size of `SHELL_TOKENS` is missing or not a number.
 */
export function shellSizesFromTokens(shellGroup: Readonly<Record<string, string>>): ShellSizes {
  const sizes = {} as Record<ShellSizeName, number>;
  for (const name of Object.keys(SHELL_TOKENS) as ShellSizeName[]) {
    const token = SHELL_TOKENS[name];
    const raw: unknown = Object.hasOwn(shellGroup, token) ? shellGroup[token] : undefined;
    if (raw === undefined) {
      throw new Error(`@miragon/modeler-shell: the shell token ${token} is missing`);
    }
    if (typeof raw !== "string" || !PIXEL_OR_PLAIN_NUMBER.test(raw)) {
      throw new Error(
        `@miragon/modeler-shell: the shell token ${token} is not a number: ${JSON.stringify(raw)}`,
      );
    }
    sizes[name] = Number.parseFloat(raw);
  }
  return sizes;
}
