import type { Appearance, Theme } from "../../core/index.js";
import type { DisposableLike, VsCodeLike, WebviewPanelLike } from "./types.js";

export interface ThemeBridgeOptions {
  /** The modes the modeler can show, a static value of the modeler package (`["light"]` today). */
  themes: readonly Theme[];
  /** Full key of `miragon.<modeler>.colorTheme`; omit until the modeler can show dark. */
  settingKey?: string;
}

/** The resolved appearance right now: color theme kind (and setting) through `resolveAppearance`. */
export function currentAppearance(vscode: VsCodeLike, options: ThemeBridgeOptions): Appearance {
  throw new Error("@miragon/modeler-shell: currentAppearance is not implemented yet");
}

/**
 * Posts an `AppearanceMessage` to the panel's webview on `onDidChangeActiveColorTheme`, on a change
 * of `settingKey` and whenever the panel becomes visible again (hidden retained webviews may miss
 * messages). Disposes itself with the panel.
 */
export function connectThemeBridge(
  vscode: VsCodeLike,
  panel: WebviewPanelLike,
  options: ThemeBridgeOptions,
): DisposableLike {
  throw new Error("@miragon/modeler-shell: connectThemeBridge is not implemented yet");
}
