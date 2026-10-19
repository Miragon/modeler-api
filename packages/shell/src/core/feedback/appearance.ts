import type { Theme } from "../appearance.js";

/** The web app's mode choice (guide §13.3): Appearance, System · Light · Dark. */
export type AppearanceChoice = "system" | "light" | "dark";

/** Where the web app keeps the choice: `light` or `dark`; "System" removes the entry (guide §13.3). */
export const APPEARANCE_STORAGE_KEY = "miragon.darstellung";

/**
 * The two `theme-color` values (guide §11, §13.3): light is the app's own value (`#335DE5`, `fest`
 * `--cd-blau` of the vendored `cd-tokens.generated.json`), dark `#1D1D1D` (`dunkel`
 * `--cd-ui-grund`). The modeler reads both from its vendored JSON; the shell keeps no colour.
 */
export interface ThemeColors {
  light: string;
  dark: string;
}

/** `"light"` and `"dark"` pass, everything else (a missing entry, a foreign value) is `"system"`. */
export function parseAppearanceChoice(stored: unknown): AppearanceChoice {
  // TODO(feedback): only "light" and "dark" pass.
  void stored;
  return "system";
}

/** What `<html>` and the meta tags carry for a choice. */
export interface DocumentMode {
  /** `data-cd-theme` on `<html>`. */
  theme: "system" | Theme;
  /** `<meta name="color-scheme" content>`. */
  colorScheme: "light dark" | Theme;
  /** The `content` of the `theme-color` metas with `media="(prefers-color-scheme: light|dark)"`. */
  themeColor: ThemeColors;
}

/**
 * The document mode for `choice` (guide §13.3). A modeler that cannot show dark (`themes` without
 * `"dark"`) is `light` whatever the choice: theme `light`, color-scheme `light`, both theme
 * colours `colors.light`. Dark-capable: `system` → theme `system`, color-scheme `light dark`,
 * `colors` as they are; `light`/`dark` → that theme and color-scheme, both theme colours the
 * chosen mode's, so the browser bar matches a fixed choice under the other system mode.
 */
export function documentMode(
  choice: AppearanceChoice,
  themes: readonly Theme[],
  colors: ThemeColors,
): DocumentMode {
  // TODO(feedback): the table above.
  void choice;
  void themes;
  return { theme: "light", colorScheme: "light", themeColor: { light: colors.light, dark: colors.light } };
}

export interface WebModeScriptOptions {
  /** The modes the modeler can show, as passed to `mountShell`. */
  themes: readonly Theme[];
  themeColors: ThemeColors;
}

/**
 * The body of the inline `<script>` in `<head>`, before the first stylesheet (guide §13.3). With
 * `themes` including `"dark"`: the guide's script, which reads `APPEARANCE_STORAGE_KEY` inside
 * `try`/`catch`, writes `data-cd-theme`, `color-scheme` and both `theme-color` metas for a fixed
 * choice and sets `data-cd-kontrast="hoch"` under `(prefers-contrast: more)`. Light-only: the
 * contrast line alone. Plain ES5 without the modeler's bundle, so it runs before the first paint.
 */
export function webModeScript(options: WebModeScriptOptions): string {
  // TODO(feedback): both variants above.
  void options;
  return "";
}

/**
 * The `<head>` markup the web app's `index.html` carries for its mode, as one string (for a Vite
 * `transformIndexHtml` hook or to paste): dark-capable `<meta name="color-scheme" content="light
 * dark">`, two `theme-color` metas with `media` and the script; light-only one `theme-color`
 * without `media` and the contrast script. `<html>` itself carries `lang` and
 * `data-cd-theme="<documentMode("system", themes, colors).theme>"` statically.
 */
export function webHeadMarkup(options: WebModeScriptOptions): string {
  // TODO(feedback): the markup above, attribute values escaped.
  return `<script>${webModeScript(options)}</script>`;
}
