/**
 * The parts of the `vscode` namespace the extension helpers use, typed structurally: the shell
 * never imports `vscode`; the extension passes its own `import * as vscode from "vscode"`.
 */

export interface DisposableLike {
  dispose(): unknown;
}

export interface ColorThemeLike {
  /** `vscode.ColorThemeKind`: 1 Light, 2 Dark, 3 HighContrast, 4 HighContrastLight. */
  readonly kind: number;
}

export interface VsCodeLike {
  readonly window: {
    readonly activeColorTheme: ColorThemeLike;
    onDidChangeActiveColorTheme(listener: (theme: ColorThemeLike) => unknown): DisposableLike;
  };
  readonly workspace: {
    getConfiguration(section?: string): { get<T>(key: string): T | undefined };
    onDidChangeConfiguration(
      listener: (event: { affectsConfiguration(section: string): boolean }) => unknown,
    ): DisposableLike;
  };
}

/** `vscode.WebviewPanel` as far as the theme bridge needs it. */
export interface WebviewPanelLike {
  readonly webview: { postMessage(message: unknown): unknown };
  readonly visible: boolean;
  onDidChangeViewState(
    listener: (event: { readonly webviewPanel: { readonly visible: boolean } }) => unknown,
  ): DisposableLike;
  onDidDispose(listener: () => unknown): DisposableLike;
}
