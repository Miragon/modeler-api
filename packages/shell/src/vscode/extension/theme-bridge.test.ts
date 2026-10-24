import { describe, expect, it, vi } from "vitest";

import type { Appearance, ColorThemeSetting, Theme } from "../../core/index.js";
import {
  APPEARANCE_MESSAGE_TYPE,
  connectThemeBridge,
  currentAppearance,
  type ColorThemeLike,
  type DisposableLike,
  type VsCodeLike,
  type WebviewPanelLike,
} from "./index.js";

const SETTING_KEY = "miragon.eventStorming.colorTheme";

class Emitter<T> {
  private readonly listeners = new Set<(value: T) => unknown>();

  readonly event = (listener: (value: T) => unknown): DisposableLike => {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  };

  fire(value: T): void {
    for (const listener of [...this.listeners]) listener(value);
  }

  get size(): number {
    return this.listeners.size;
  }
}

function fakeVsCode(kind: number, settings: Record<string, unknown> = {}) {
  const themeChanged = new Emitter<ColorThemeLike>();
  const configurationChanged = new Emitter<{ affectsConfiguration(section: string): boolean }>();
  const values = { ...settings };
  const getConfiguration = vi.fn((section?: string) => ({
    get: <T>(key: string): T | undefined =>
      values[section ? `${section}.${key}` : key] as T | undefined,
  }));
  const vscode = {
    window: {
      activeColorTheme: { kind },
      onDidChangeActiveColorTheme: themeChanged.event,
    },
    workspace: {
      getConfiguration,
      onDidChangeConfiguration: configurationChanged.event,
    },
  } satisfies VsCodeLike;
  return {
    vscode,
    themeChanged,
    configurationChanged,
    getConfiguration,
    setKind(next: number) {
      vscode.window.activeColorTheme = { kind: next };
      themeChanged.fire({ kind: next });
    },
    setSetting(key: string, value: unknown) {
      values[key] = value;
      configurationChanged.fire({
        affectsConfiguration: (section) => key === section || key.startsWith(`${section}.`),
      });
    },
  };
}

function fakePanel(visible = true) {
  const viewStateChanged = new Emitter<{ readonly webviewPanel: { readonly visible: boolean } }>();
  const disposed = new Emitter<void>();
  const postMessage = vi.fn((_message: unknown) => Promise.resolve(true));
  const panel = {
    webview: { postMessage },
    visible,
    onDidChangeViewState: viewStateChanged.event,
    onDidDispose: (listener: () => unknown) => disposed.event(listener),
  } satisfies WebviewPanelLike;
  return {
    panel,
    postMessage,
    viewStateChanged,
    disposed,
    setVisible(next: boolean) {
      panel.visible = next;
      viewStateChanged.fire({ webviewPanel: { visible: next } });
    },
    dispose() {
      disposed.fire();
    },
  };
}

function message(appearance: Appearance) {
  return { type: APPEARANCE_MESSAGE_TYPE, appearance };
}

const LIGHT: Appearance = { theme: "light" };
const DARK: Appearance = { theme: "dark" };
const LIGHT_HOCH: Appearance = { theme: "light", kontrast: "hoch" };
const DARK_HOCH: Appearance = { theme: "dark", kontrast: "hoch" };

describe("currentAppearance", () => {
  const lightOnly: readonly Theme[] = ["light"];
  const lightAndDark: readonly Theme[] = ["light", "dark"];

  type Row = [
    kind: number,
    setting: ColorThemeSetting | undefined,
    lightOnly: Appearance,
    both: Appearance,
  ];
  const rows: Row[] = [
    [1, undefined, LIGHT, LIGHT],
    [2, undefined, LIGHT, DARK],
    [3, undefined, LIGHT_HOCH, DARK_HOCH],
    [4, undefined, LIGHT_HOCH, LIGHT_HOCH],
    [1, "automatic", LIGHT, LIGHT],
    [2, "automatic", LIGHT, DARK],
    [3, "automatic", LIGHT_HOCH, DARK_HOCH],
    [4, "automatic", LIGHT_HOCH, LIGHT_HOCH],
    [1, "light", LIGHT, LIGHT],
    [2, "light", LIGHT, LIGHT],
    [3, "light", LIGHT_HOCH, LIGHT_HOCH],
    [4, "light", LIGHT_HOCH, LIGHT_HOCH],
    [1, "dark", LIGHT, DARK],
    [2, "dark", LIGHT, DARK],
    [3, "dark", LIGHT_HOCH, DARK_HOCH],
    [4, "dark", LIGHT_HOCH, DARK_HOCH],
  ];

  it.each(rows)(
    "kind %i, setting %s: light-only %o, light and dark %o",
    (kind, setting, light, both) => {
      const settings = setting ? { [SETTING_KEY]: setting } : {};
      const { vscode } = fakeVsCode(kind, settings);
      expect(currentAppearance(vscode, { themes: lightOnly, settingKey: SETTING_KEY })).toEqual(
        light,
      );
      expect(currentAppearance(vscode, { themes: lightAndDark, settingKey: SETTING_KEY })).toEqual(
        both,
      );
    },
  );

  it("never turns a light-only modeler dark", () => {
    for (const kind of [1, 2, 3, 4, 0, 99]) {
      for (const setting of ["automatic", "light", "dark", undefined]) {
        const { vscode } = fakeVsCode(kind, { [SETTING_KEY]: setting });
        expect(
          currentAppearance(vscode, { themes: ["light"], settingKey: SETTING_KEY }).theme,
        ).toBe("light");
      }
    }
  });

  it("ignores the setting without settingKey", () => {
    const { vscode, getConfiguration } = fakeVsCode(1, { [SETTING_KEY]: "dark" });
    expect(currentAppearance(vscode, { themes: ["light", "dark"] })).toEqual(LIGHT);
    expect(getConfiguration).not.toHaveBeenCalled();
  });

  it("reads the setting from its section", () => {
    const { vscode, getConfiguration } = fakeVsCode(1, { [SETTING_KEY]: "dark" });
    currentAppearance(vscode, { themes: ["light", "dark"], settingKey: SETTING_KEY });
    expect(getConfiguration).toHaveBeenCalledWith("miragon.eventStorming");
  });

  it("treats an unknown setting value as automatic", () => {
    const { vscode } = fakeVsCode(2, { [SETTING_KEY]: "solarized" });
    expect(
      currentAppearance(vscode, { themes: ["light", "dark"], settingKey: SETTING_KEY }),
    ).toEqual(DARK);
  });
});

describe("connectThemeBridge", () => {
  const themes: readonly Theme[] = ["light", "dark"];

  it("posts nothing on connect (the HTML already carries the appearance)", () => {
    const host = fakeVsCode(1);
    const view = fakePanel();
    connectThemeBridge(host.vscode, view.panel, { themes });
    expect(view.postMessage).not.toHaveBeenCalled();
  });

  it("posts the resolved appearance on every color theme change", () => {
    const host = fakeVsCode(1);
    const view = fakePanel();
    connectThemeBridge(host.vscode, view.panel, { themes });

    host.setKind(2);
    host.setKind(4);
    host.setKind(3);

    expect(view.postMessage.mock.calls.map(([sent]) => sent)).toEqual([
      message(DARK),
      message(LIGHT_HOCH),
      message(DARK_HOCH),
    ]);
  });

  it("posts light (with hoch) to a light-only modeler under dark themes", () => {
    const host = fakeVsCode(1);
    const view = fakePanel();
    connectThemeBridge(host.vscode, view.panel, { themes: ["light"] });

    host.setKind(2);
    host.setKind(3);

    expect(view.postMessage.mock.calls.map(([sent]) => sent)).toEqual([
      message(LIGHT),
      message(LIGHT_HOCH),
    ]);
  });

  it("posts when the setting changes, not for unrelated configuration keys", () => {
    const host = fakeVsCode(1, { [SETTING_KEY]: "automatic" });
    const view = fakePanel();
    connectThemeBridge(host.vscode, view.panel, { themes, settingKey: SETTING_KEY });

    host.setSetting("editor.fontSize", 14);
    expect(view.postMessage).not.toHaveBeenCalled();

    host.setSetting(SETTING_KEY, "dark");
    expect(view.postMessage).toHaveBeenLastCalledWith(message(DARK));
    expect(view.postMessage).toHaveBeenCalledTimes(1);
  });

  it("does not listen to the configuration without settingKey", () => {
    const host = fakeVsCode(1);
    const view = fakePanel();
    connectThemeBridge(host.vscode, view.panel, { themes });
    expect(host.configurationChanged.size).toBe(0);
  });

  it("re-sends the appearance when the panel becomes visible again", () => {
    const host = fakeVsCode(2);
    const view = fakePanel(true);
    connectThemeBridge(host.vscode, view.panel, { themes });

    view.setVisible(true);
    expect(view.postMessage).not.toHaveBeenCalled();

    view.setVisible(false);
    expect(view.postMessage).not.toHaveBeenCalled();

    view.setVisible(true);
    expect(view.postMessage).toHaveBeenCalledTimes(1);
    expect(view.postMessage).toHaveBeenLastCalledWith(message(DARK));
  });

  it("re-sends for a panel that was connected while hidden", () => {
    const host = fakeVsCode(1);
    const view = fakePanel(false);
    connectThemeBridge(host.vscode, view.panel, { themes });

    view.setVisible(true);

    expect(view.postMessage).toHaveBeenCalledWith(message(LIGHT));
  });

  it("disposes every listener with the panel", () => {
    const host = fakeVsCode(1, { [SETTING_KEY]: "automatic" });
    const view = fakePanel();
    connectThemeBridge(host.vscode, view.panel, { themes, settingKey: SETTING_KEY });
    expect(host.themeChanged.size).toBe(1);
    expect(host.configurationChanged.size).toBe(1);
    expect(view.viewStateChanged.size).toBe(1);
    expect(view.disposed.size).toBe(1);

    view.dispose();

    expect(host.themeChanged.size).toBe(0);
    expect(host.configurationChanged.size).toBe(0);
    expect(view.viewStateChanged.size).toBe(0);
    expect(view.disposed.size).toBe(0);
    host.setKind(2);
    host.setSetting(SETTING_KEY, "dark");
    expect(view.postMessage).not.toHaveBeenCalled();
  });

  it("disposes through the returned disposable, idempotently", () => {
    const host = fakeVsCode(1);
    const view = fakePanel();
    const bridge = connectThemeBridge(host.vscode, view.panel, { themes });

    bridge.dispose();
    bridge.dispose();
    view.dispose();

    expect(host.themeChanged.size).toBe(0);
    expect(view.disposed.size).toBe(0);
    host.setKind(2);
    expect(view.postMessage).not.toHaveBeenCalled();
  });

  it("throws without themes", () => {
    const host = fakeVsCode(1);
    const view = fakePanel();
    expect(() => connectThemeBridge(host.vscode, view.panel, { themes: [] })).toThrow(
      /at least one theme/,
    );
    expect(host.themeChanged.size).toBe(0);
  });
});
