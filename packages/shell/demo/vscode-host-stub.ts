import type { Appearance, Theme } from "../src/core.js";
import {
  connectThemeBridge,
  currentAppearance,
  renderWebviewHtml,
  type ColorThemeLike,
  type DisposableLike,
  type VsCodeLike,
  type WebviewPanelLike,
} from "../src/vscode-extension.js";

/** `vscode.ColorThemeKind`. */
export type ColorThemeKind = 1 | 2 | 3 | 4;

/** The body classes VS Code's webview host page sets per color theme (High Contrast Light keeps both). */
const BODY_CLASSES: Readonly<Record<ColorThemeKind, readonly string[]>> = {
  1: ["vscode-light"],
  2: ["vscode-dark"],
  3: ["vscode-high-contrast"],
  4: ["vscode-high-contrast-light", "vscode-high-contrast"],
};
const ALL_BODY_CLASSES = Object.values(BODY_CLASSES).flat();

/** The VS Code color theme that requests `appearance` (guide §13.3). */
export function colorThemeKindOf(appearance: Appearance): ColorThemeKind {
  if (appearance.kontrast) return appearance.theme === "dark" ? 3 : 4;
  return appearance.theme === "dark" ? 2 : 1;
}

export interface VsCodeHostStub {
  readonly kind: ColorThemeKind;
  /** What VS Code does on a color theme change: body classes first, then the extension's bridge posts. */
  setColorThemeKind(kind: ColorThemeKind): void;
  /** Messages the bridge posted that have not reached the window yet. */
  pendingMessages(): number;
}

/**
 * Stands in for VS Code around the demo's webview: `<html>` gets the attributes `renderWebviewHtml`
 * writes before the first paint, `<body>` the host page's theme classes, and the real
 * `connectThemeBridge` runs against a fake `vscode` namespace whose panel posts to this window.
 */
export function startVsCodeHostStub(requested: Appearance, themes: readonly Theme[]): VsCodeHostStub {
  let kind = colorThemeKindOf(requested);
  const themeListeners = new Set<(theme: ColorThemeLike) => unknown>();
  const none: DisposableLike = { dispose: () => undefined };
  const vscode: VsCodeLike = {
    window: {
      get activeColorTheme() {
        return { kind };
      },
      onDidChangeActiveColorTheme(listener) {
        themeListeners.add(listener);
        return { dispose: () => themeListeners.delete(listener) };
      },
    },
    workspace: {
      getConfiguration: () => ({ get: () => undefined }),
      onDidChangeConfiguration: () => none,
    },
  };
  let posted = 0;
  let delivered = 0;
  // Registered before the shell's own listener, so it counts a message before the shell applies it.
  window.addEventListener("message", () => delivered++);
  const panel: WebviewPanelLike = {
    webview: {
      postMessage(message) {
        posted++;
        window.postMessage(message, window.location.origin);
      },
    },
    visible: true,
    onDidChangeViewState: () => none,
    onDidDispose: () => none,
  };

  const html = new DOMParser().parseFromString(
    renderWebviewHtml({
      cspSource: window.location.origin,
      scriptUri: "webview.js",
      title: document.title,
      lang: "en",
      appearance: currentAppearance(vscode, { themes }),
    }),
    "text/html",
  ).documentElement;
  for (const name of html.getAttributeNames()) {
    if (name === "class") document.documentElement.classList.add(...html.classList);
    else document.documentElement.setAttribute(name, html.getAttribute(name) ?? "");
  }

  const setBodyClasses = (next: ColorThemeKind): void => {
    document.body.classList.remove(...ALL_BODY_CLASSES);
    document.body.classList.add(...BODY_CLASSES[next]);
  };
  setBodyClasses(kind);
  connectThemeBridge(vscode, panel, { themes });

  return {
    get kind() {
      return kind;
    },
    setColorThemeKind(next) {
      kind = next;
      setBodyClasses(next);
      for (const listener of themeListeners) listener({ kind: next });
    },
    pendingMessages: () => posted - delivered,
  };
}
