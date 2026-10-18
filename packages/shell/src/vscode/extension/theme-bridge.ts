import {
  requestedAppearance,
  resolveAppearance,
  type Appearance,
  type ColorThemeSetting,
  type Theme,
} from "../../core/index.js";
import { appearanceMessage } from "../protocol.js";
import type { DisposableLike, VsCodeLike, WebviewPanelLike } from "./types.js";

export interface ThemeBridgeOptions {
  /** The modes the modeler can show, a static value of the modeler package (`["light"]` today). */
  themes: readonly Theme[];
  /** Full key of `miragon.<modeler>.colorTheme`; omit until the modeler can show dark. */
  settingKey?: string;
}

function isColorThemeSetting(value: unknown): value is ColorThemeSetting {
  return value === "automatic" || value === "light" || value === "dark";
}

function readColorThemeSetting(vscode: VsCodeLike, settingKey: string): ColorThemeSetting | undefined {
  const separator = settingKey.lastIndexOf(".");
  const value =
    separator < 0
      ? vscode.workspace.getConfiguration().get<unknown>(settingKey)
      : vscode.workspace
          .getConfiguration(settingKey.slice(0, separator))
          .get<unknown>(settingKey.slice(separator + 1));
  return isColorThemeSetting(value) ? value : undefined;
}

/**
 * The resolved appearance right now: color theme kind (and setting) through `resolveAppearance`.
 * A setting value outside `automatic | light | dark` counts as `automatic`.
 */
export function currentAppearance(vscode: VsCodeLike, options: ThemeBridgeOptions): Appearance {
  const setting = options.settingKey ? readColorThemeSetting(vscode, options.settingKey) : undefined;
  return resolveAppearance(requestedAppearance(vscode.window.activeColorTheme.kind, setting), options.themes);
}

/**
 * Posts an `AppearanceMessage` to the panel's webview on `onDidChangeActiveColorTheme`, on a change
 * of `settingKey` and whenever the panel becomes visible again (hidden retained webviews may miss
 * messages). Disposes itself with the panel. Throws when `themes` is empty.
 */
export function connectThemeBridge(
  vscode: VsCodeLike,
  panel: WebviewPanelLike,
  options: ThemeBridgeOptions,
): DisposableLike {
  if (options.themes.length === 0) {
    throw new Error("@miragon/modeler-shell: connectThemeBridge needs at least one theme");
  }
  const { settingKey } = options;
  const post = (): void => {
    void panel.webview.postMessage(appearanceMessage(currentAppearance(vscode, options)));
  };

  let wasVisible = panel.visible;
  const subscriptions: DisposableLike[] = [
    vscode.window.onDidChangeActiveColorTheme(post),
    panel.onDidChangeViewState(({ webviewPanel }) => {
      const becameVisible = webviewPanel.visible && !wasVisible;
      wasVisible = webviewPanel.visible;
      if (becameVisible) post();
    }),
  ];
  if (settingKey) {
    subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(settingKey)) post();
      }),
    );
  }

  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    for (const subscription of subscriptions.splice(0)) subscription.dispose();
  };
  subscriptions.push(panel.onDidDispose(dispose));
  return { dispose };
}
