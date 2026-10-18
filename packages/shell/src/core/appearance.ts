/** The modes a Miragon modeler can show (guide §13.3). */
export type Theme = "light" | "dark";

/** High contrast; written as `data-cd-kontrast="hoch"` on the same element as `data-cd-theme`. */
export type Kontrast = "hoch";

export interface Appearance {
  theme: Theme;
  kontrast?: Kontrast;
}

/**
 * The one appearance decision of guide §13.5: a theme the modeler cannot show is never shown
 * (`themes[0]` wins, so `["light"]` stays light whatever the host requests); `kontrast` always
 * passes through. Throws when `themes` is empty.
 */
export function resolveAppearance(requested: Appearance, themes: readonly Theme[]): Appearance {
  const [fallback] = themes;
  if (fallback === undefined) {
    throw new Error(
      "@miragon/modeler-shell: resolveAppearance needs at least one theme the modeler can show",
    );
  }
  const theme = themes.includes(requested.theme) ? requested.theme : fallback;
  return withKontrast(theme, requested.kontrast);
}

// Appearances arrive through postMessage and settings, so only the one known value passes.
function withKontrast(theme: Theme, kontrast: unknown): Appearance {
  return kontrast === "hoch" ? { theme, kontrast } : { theme };
}

/**
 * The appearance VS Code requests for `vscode.window.activeColorTheme.kind`:
 * 1 Light → light, 2 Dark → dark, 3 HighContrast → dark + hoch, 4 HighContrastLight → light + hoch;
 * any other value → light.
 */
export function appearanceFromColorThemeKind(kind: number): Appearance {
  switch (kind) {
    case 2:
      return { theme: "dark" };
    case 3:
      return { theme: "dark", kontrast: "hoch" };
    case 4:
      return { theme: "light", kontrast: "hoch" };
    default:
      return { theme: "light" };
  }
}

/** The values of the setting `miragon.<modeler>.colorTheme` (it ships once a modeler can show dark). */
export type ColorThemeSetting = "automatic" | "light" | "dark";

/**
 * The requested appearance in an IDE host: the setting's theme unless it is `automatic` (or
 * missing), the contrast always from the color theme kind.
 */
export function requestedAppearance(kind: number, setting?: ColorThemeSetting): Appearance {
  const fromKind = appearanceFromColorThemeKind(kind);
  const theme = setting === "light" || setting === "dark" ? setting : fromKind.theme;
  return withKontrast(theme, fromKind.kontrast);
}

/**
 * The fallback signal inside a VS Code webview: the body classes `vscode-high-contrast-light`
 * (checked first, VS Code adds `vscode-high-contrast` to it as well), `vscode-high-contrast`,
 * `vscode-dark`, `vscode-light`. `undefined` when none is set. Never use them for styling.
 */
export function appearanceFromBodyClasses(classes: Iterable<string>): Appearance | undefined {
  const present = new Set(classes);
  if (present.has("vscode-high-contrast-light")) return { theme: "light", kontrast: "hoch" };
  if (present.has("vscode-high-contrast")) return { theme: "dark", kontrast: "hoch" };
  if (present.has("vscode-dark")) return { theme: "dark" };
  if (present.has("vscode-light")) return { theme: "light" };
  return undefined;
}

export interface AppearanceAttributes {
  "data-cd-theme": Theme;
  "data-cd-kontrast"?: Kontrast;
}

/** The attributes for `<html>` (own document) or the modeler container (foreign page). */
export function appearanceAttributes(appearance: Appearance): AppearanceAttributes {
  return appearance.kontrast === "hoch"
    ? { "data-cd-theme": appearance.theme, "data-cd-kontrast": "hoch" }
    : { "data-cd-theme": appearance.theme };
}
