import {
  appearanceFromColorThemeKind,
  resolveAppearance,
  type Appearance,
  type Theme,
} from "../../core/index.js";
import type { ColorThemeKind } from "../vscode-stub.js";

/** A VS Code color theme the smoke test switches to through `workbench.colorTheme`. */
export interface VsCodeColorTheme {
  /** File-name-safe id, used in screenshot names: `light`, `dark`, `high-contrast-dark`, `high-contrast-light`. */
  id: string;
  /** The value of `workbench.colorTheme`. */
  name: string;
  /** `vscode.ColorThemeKind` of the theme. */
  kind: ColorThemeKind;
}

/** VS Code's four default themes, one per `ColorThemeKind`. */
export const VSCODE_COLOR_THEMES: readonly VsCodeColorTheme[] = [
  { id: "light", name: "Default Light Modern", kind: 1 },
  { id: "dark", name: "Default Dark Modern", kind: 2 },
  { id: "high-contrast-dark", name: "Default High Contrast", kind: 3 },
  { id: "high-contrast-light", name: "Default High Contrast Light", kind: 4 },
];

const WORKBENCH_CLASSES: Readonly<Record<ColorThemeKind, string>> = {
  1: "vs",
  2: "vs-dark",
  3: "hc-black",
  4: "hc-light",
};

// High Contrast Light keeps `vscode-high-contrast` for older extensions, so it carries both.
const WEBVIEW_BODY_CLASSES: Readonly<Record<ColorThemeKind, readonly string[]>> = {
  1: ["vscode-light"],
  2: ["vscode-dark"],
  3: ["vscode-high-contrast"],
  4: ["vscode-high-contrast", "vscode-high-contrast-light"],
};

/** Every theme class VS Code puts on a webview's `<body>`. */
export const WEBVIEW_THEME_BODY_CLASSES: readonly string[] = [
  "vscode-light",
  "vscode-dark",
  "vscode-high-contrast",
  "vscode-high-contrast-light",
];

/** The class `.monaco-workbench` carries under a theme of `kind`. */
export function workbenchThemeClass(kind: ColorThemeKind): string {
  return WORKBENCH_CLASSES[kind];
}

/** The theme classes of a webview's `<body>` under a theme of `kind`, sorted. */
export function webviewBodyClasses(kind: ColorThemeKind): readonly string[] {
  return WEBVIEW_BODY_CLASSES[kind];
}

/**
 * What the shell's theme bridge shows in the webview under a theme of `kind`, for a modeler that
 * declares `themes` (without a `colorTheme` setting): `["light"]` stays light, high contrast passes.
 */
export function expectedWebviewAppearance(
  kind: ColorThemeKind,
  themes: readonly Theme[],
): Appearance {
  return resolveAppearance(appearanceFromColorThemeKind(kind), themes);
}

/** `light`, `dark`, `light, hoch`: an appearance as the summary and the failures name it. */
export function describeAppearance(appearance: Appearance | undefined): string {
  if (!appearance) return "no data-cd-theme";
  return appearance.kontrast ? `${appearance.theme}, ${appearance.kontrast}` : appearance.theme;
}
