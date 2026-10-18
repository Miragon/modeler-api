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
  throw new Error("@miragon/modeler-shell: resolveAppearance is not implemented yet");
}

/**
 * The appearance VS Code requests for `vscode.window.activeColorTheme.kind`:
 * 1 Light → light, 2 Dark → dark, 3 HighContrast → dark + hoch, 4 HighContrastLight → light + hoch;
 * any other value → light.
 */
export function appearanceFromColorThemeKind(kind: number): Appearance {
  throw new Error("@miragon/modeler-shell: appearanceFromColorThemeKind is not implemented yet");
}

/** The values of the setting `miragon.<modeler>.colorTheme` (it ships once a modeler can show dark). */
export type ColorThemeSetting = "automatic" | "light" | "dark";

/**
 * The requested appearance in an IDE host: the setting's theme unless it is `automatic` (or
 * missing), the contrast always from the color theme kind.
 */
export function requestedAppearance(kind: number, setting?: ColorThemeSetting): Appearance {
  throw new Error("@miragon/modeler-shell: requestedAppearance is not implemented yet");
}

/**
 * The fallback signal inside a VS Code webview: the body classes `vscode-high-contrast-light`
 * (checked first, VS Code adds `vscode-high-contrast` to it as well), `vscode-high-contrast`,
 * `vscode-dark`, `vscode-light`. `undefined` when none is set. Never use them for styling.
 */
export function appearanceFromBodyClasses(classes: Iterable<string>): Appearance | undefined {
  throw new Error("@miragon/modeler-shell: appearanceFromBodyClasses is not implemented yet");
}

export interface AppearanceAttributes {
  "data-cd-theme": Theme;
  "data-cd-kontrast"?: Kontrast;
}

/** The attributes for `<html>` (own document) or the modeler container (foreign page). */
export function appearanceAttributes(appearance: Appearance): AppearanceAttributes {
  throw new Error("@miragon/modeler-shell: appearanceAttributes is not implemented yet");
}
