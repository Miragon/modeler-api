import type { Appearance, ColorThemeSetting, Theme } from "../core/index.js";
import {
  connectThemeBridge,
  currentAppearance,
  renderWebviewHtml,
  type ColorThemeLike,
  type DisposableLike,
  type VsCodeLike,
  type WebviewPanelLike,
} from "../vscode/extension/index.js";

/*
 * Runs in the page, in front of a modeler's webview bundle: a stand-in for the VS Code around it,
 * so a modeler's e2e suite runs the conformance kit for the `ide` host without VS Code.
 */

/** `vscode.ColorThemeKind`: 1 Light, 2 Dark, 3 High Contrast, 4 High Contrast Light. */
export type ColorThemeKind = 1 | 2 | 3 | 4;

/** The body classes VS Code's webview host page sets per color theme (High Contrast Light keeps both). */
const BODY_CLASSES: Readonly<Record<ColorThemeKind, readonly string[]>> = {
  1: ["vscode-light"],
  2: ["vscode-dark"],
  3: ["vscode-high-contrast"],
  4: ["vscode-high-contrast-light", "vscode-high-contrast"],
};
const ALL_BODY_CLASSES = Object.values(BODY_CLASSES).flat();
const REDUCE_MOTION_BODY_CLASS = "vscode-reduce-motion";

/**
 * The rules of VS Code's default webview stylesheet the shell's own-document reset must beat
 * (implementation notes, "VS Code: host hygiene"), with deliberately foreign values so a leak shows.
 */
const VSCODE_DEFAULT_STYLES = `@layer vscode-default {
  body { margin: 0; padding: 0 20px; color: currentColor; font-family: serif; font-size: 17px; }
  kbd { box-shadow: inset 0 -1px 0 currentColor; vertical-align: middle; padding: 1px 3px; border-radius: 3px; font-family: serif; }
  code { font-family: serif; padding: 1px 3px; border-radius: 4px; }
  a:focus, input:focus, select:focus, textarea:focus { outline: 1px solid -webkit-focus-ring-color; outline-offset: -1px; }
}`;

/** The default setting key the stub answers when `colorTheme` is given without one. */
export const STUB_SETTING_KEY = "miragon.modeler.colorTheme";

/** The VS Code color theme that requests `appearance` (guide §13.3). */
export function colorThemeKindOf(appearance: Appearance): ColorThemeKind {
  if (appearance.kontrast) return appearance.theme === "dark" ? 3 : 4;
  return appearance.theme === "dark" ? 2 : 1;
}

export interface VsCodeWebviewStubOptions {
  /** What VS Code requests: its color theme, as the appearance the kit asks for. */
  requested: Appearance;
  /** The modes the modeler declares (what its extension passes to the theme bridge). */
  themes: readonly Theme[];
  /** `<html lang>`; default `"en"`. */
  lang?: string | undefined;
  /** The value of the modeler's `colorTheme` setting (from its dark-mode release on). */
  colorTheme?: ColorThemeSetting | undefined;
  /** The full setting key the stub answers and the bridge listens to; default `STUB_SETTING_KEY`. */
  settingKey?: string | undefined;
  /** VS Code's `workbench.reduceMotion` (the body class `vscode-reduce-motion`). */
  reduceMotion?: boolean | undefined;
  /** What `getState()` of the stubbed `acquireVsCodeApi()` returns at first. */
  state?: unknown;
}

/** The stubbed `acquireVsCodeApi()`. */
export interface StubbedVsCodeApi {
  getState(): unknown;
  setState(state: unknown): void;
  postMessage(message: unknown): void;
}

export interface VsCodeWebviewStub {
  readonly kind: ColorThemeKind;
  /** What VS Code does on a color theme change: body classes first, then the extension's bridge posts. */
  setColorThemeKind(kind: ColorThemeKind): void;
  /** Changes the `colorTheme` setting, as the user does in the settings editor. */
  setColorTheme(setting: ColorThemeSetting | undefined): void;
  setReduceMotion(reduceMotion: boolean): void;
  /** Messages the bridge posted that have not reached the window yet. */
  pendingMessages(): number;
  /** What the webview posted with `acquireVsCodeApi().postMessage`. */
  readonly posted: readonly unknown[];
  /** The webview state as the last `setState` left it. */
  state(): unknown;
}

/** The page globals the stub sets. */
export type StubWindow = Window & {
  /** The stub of `installVsCodeWebviewStub`, for a Playwright suite to drive. */
  __modelerShellVsCodeStub?: VsCodeWebviewStub;
  acquireVsCodeApi?: () => StubbedVsCodeApi;
};

/**
 * The stub's options from a query string (`theme`, `kontrast=hoch`, `colorTheme`, `reduceMotion`),
 * the counterpart of `vsCodeStubSearch` of `@miragon/modeler-shell/testing`.
 */
export function stubOptionsFromSearch(
  search: string,
): Pick<VsCodeWebviewStubOptions, "requested" | "colorTheme" | "reduceMotion"> {
  const params = new URLSearchParams(search);
  const theme: Theme = params.get("theme") === "dark" ? "dark" : "light";
  const setting = params.get("colorTheme");
  return {
    requested: params.get("kontrast") === "hoch" ? { theme, kontrast: "hoch" } : { theme },
    colorTheme:
      setting === "automatic" || setting === "light" || setting === "dark" ? setting : undefined,
    reduceMotion: params.has("reduceMotion"),
  };
}

/**
 * Stands in for VS Code around the page: its default stylesheet in `@layer vscode-default`, `<html>`
 * with the attributes `renderWebviewHtml` writes before the first paint, `<body>` with the host
 * page's theme (and reduce-motion) classes, `acquireVsCodeApi()`, and the real `connectThemeBridge`
 * running against a fake `vscode` namespace whose panel posts to this window. Call it before the
 * modeler's webview code runs; also exposed as `window.__modelerShellVsCodeStub`.
 */
export function installVsCodeWebviewStub(options: VsCodeWebviewStubOptions): VsCodeWebviewStub {
  const settingKey = options.settingKey ?? STUB_SETTING_KEY;
  const scope = window as StubWindow;
  let kind = colorThemeKindOf(options.requested);
  let setting = options.colorTheme;
  const themeListeners = new Set<(theme: ColorThemeLike) => unknown>();
  const configurationListeners = new Set<
    (event: { affectsConfiguration(section: string): boolean }) => unknown
  >();
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
      getConfiguration: (section?: string) => ({
        get: <T>(key: string): T | undefined =>
          (section ? `${section}.${key}` : key) === settingKey
            ? (setting as T | undefined)
            : undefined,
      }),
      onDidChangeConfiguration(listener) {
        configurationListeners.add(listener);
        return { dispose: () => configurationListeners.delete(listener) };
      },
    },
  };
  const none: DisposableLike = { dispose: () => undefined };
  let posted = 0;
  let delivered = 0;
  // Registered before the modeler's listeners, so it counts a message before the shell applies it.
  window.addEventListener("message", () => delivered++);
  const panel: WebviewPanelLike = {
    webview: {
      postMessage(message) {
        posted++;
        window.postMessage(message, "*");
      },
    },
    visible: true,
    onDidChangeViewState: () => none,
    onDidDispose: () => none,
  };
  const bridgeOptions = { themes: options.themes, settingKey };

  const defaults = document.createElement("style");
  defaults.id = "_defaultStyles";
  defaults.textContent = VSCODE_DEFAULT_STYLES;
  document.head.prepend(defaults);

  const html = new DOMParser().parseFromString(
    renderWebviewHtml({
      cspSource: window.location.origin,
      scriptUri: "webview.js",
      title: document.title,
      lang: options.lang ?? "en",
      appearance: currentAppearance(vscode, bridgeOptions),
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
  document.body.classList.toggle(REDUCE_MOTION_BODY_CLASS, options.reduceMotion === true);
  connectThemeBridge(vscode, panel, bridgeOptions);

  let state = options.state;
  const sent: unknown[] = [];
  let acquired = false;
  scope.acquireVsCodeApi = () => {
    if (acquired) throw new Error("An instance of the VS Code API has already been acquired");
    acquired = true;
    return {
      getState: () => state,
      setState(next) {
        state = next;
      },
      postMessage(message) {
        sent.push(message);
      },
    };
  };

  const stub: VsCodeWebviewStub = {
    get kind() {
      return kind;
    },
    setColorThemeKind(next) {
      kind = next;
      setBodyClasses(next);
      for (const listener of [...themeListeners]) listener({ kind: next });
    },
    setColorTheme(next) {
      setting = next;
      for (const listener of [...configurationListeners]) {
        listener({ affectsConfiguration: (section) => settingKey.startsWith(section) });
      }
    },
    setReduceMotion(reduceMotion) {
      document.body.classList.toggle(REDUCE_MOTION_BODY_CLASS, reduceMotion);
    },
    pendingMessages: () => posted - delivered,
    posted: sent,
    state: () => state,
  };
  scope.__modelerShellVsCodeStub = stub;
  return stub;
}
