import { describe, expect, it } from "vitest";

import {
  VSCODE_COLOR_THEMES,
  WEBVIEW_THEME_BODY_CLASSES,
  describeAppearance,
  expectedWebviewAppearance,
  webviewBodyClasses,
  workbenchThemeClass,
} from "./themes.js";

describe("VSCODE_COLOR_THEMES", () => {
  it("are VS Code's four default themes, one per color theme kind", () => {
    expect(VSCODE_COLOR_THEMES.map(({ id, name, kind }) => [id, name, kind])).toEqual([
      ["light", "Default Light Modern", 1],
      ["dark", "Default Dark Modern", 2],
      ["high-contrast-dark", "Default High Contrast", 3],
      ["high-contrast-light", "Default High Contrast Light", 4],
    ]);
  });

  it("have ids usable in file names", () => {
    for (const { id } of VSCODE_COLOR_THEMES) expect(id).toMatch(/^[a-z-]+$/);
  });
});

describe("workbenchThemeClass", () => {
  it("is the theme type class of .monaco-workbench", () => {
    expect([1, 2, 3, 4].map((kind) => workbenchThemeClass(kind as 1 | 2 | 3 | 4))).toEqual([
      "vs",
      "vs-dark",
      "hc-black",
      "hc-light",
    ]);
  });
});

describe("webviewBodyClasses", () => {
  it("gives High Contrast Light both high-contrast classes, as VS Code does for older extensions", () => {
    expect(webviewBodyClasses(1)).toEqual(["vscode-light"]);
    expect(webviewBodyClasses(2)).toEqual(["vscode-dark"]);
    expect(webviewBodyClasses(3)).toEqual(["vscode-high-contrast"]);
    expect(webviewBodyClasses(4)).toEqual(["vscode-high-contrast", "vscode-high-contrast-light"]);
  });

  it("are sorted and among the classes the driver reads", () => {
    for (const kind of [1, 2, 3, 4] as const) {
      const classes = webviewBodyClasses(kind);
      expect([...classes].sort()).toEqual(classes);
      for (const name of classes) expect(WEBVIEW_THEME_BODY_CLASSES).toContain(name);
    }
  });
});

describe("expectedWebviewAppearance", () => {
  it("keeps a light-only modeler light and passes high contrast", () => {
    expect([1, 2, 3, 4].map((kind) => expectedWebviewAppearance(kind as 1 | 2 | 3 | 4, ["light"]))).toEqual([
      { theme: "light" },
      { theme: "light" },
      { theme: "light", kontrast: "hoch" },
      { theme: "light", kontrast: "hoch" },
    ]);
  });

  it("follows the theme for a dark-capable modeler", () => {
    expect(
      [1, 2, 3, 4].map((kind) => expectedWebviewAppearance(kind as 1 | 2 | 3 | 4, ["light", "dark"])),
    ).toEqual([
      { theme: "light" },
      { theme: "dark" },
      { theme: "dark", kontrast: "hoch" },
      { theme: "light", kontrast: "hoch" },
    ]);
  });
});

describe("describeAppearance", () => {
  it("names the theme and the contrast", () => {
    expect(describeAppearance({ theme: "dark" })).toBe("dark");
    expect(describeAppearance({ theme: "light", kontrast: "hoch" })).toBe("light, hoch");
    expect(describeAppearance(undefined)).toBe("no data-cd-theme");
  });
});
