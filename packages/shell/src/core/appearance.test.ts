import { describe, expect, it } from "vitest";
import {
  REDUCED_MOTION_CLASS,
  appearanceAttributes,
  appearanceFromBodyClasses,
  appearanceFromColorThemeKind,
  reducedMotionFromBodyClasses,
  requestedAppearance,
  resolveAppearance,
  type Appearance,
} from "./appearance.js";

describe("resolveAppearance (guide §13.5)", () => {
  it("keeps a light-only modeler light whatever the host requests", () => {
    expect(resolveAppearance({ theme: "dark" }, ["light"])).toStrictEqual({ theme: "light" });
    expect(resolveAppearance({ theme: "light" }, ["light"])).toStrictEqual({ theme: "light" });
  });

  it("always passes high contrast through", () => {
    expect(resolveAppearance({ theme: "dark", kontrast: "hoch" }, ["light"])).toStrictEqual({
      theme: "light",
      kontrast: "hoch",
    });
    expect(resolveAppearance({ theme: "dark", kontrast: "hoch" }, ["light", "dark"])).toStrictEqual(
      {
        theme: "dark",
        kontrast: "hoch",
      },
    );
  });

  it("shows the requested theme when the modeler can", () => {
    expect(resolveAppearance({ theme: "dark" }, ["light", "dark"])).toStrictEqual({
      theme: "dark",
    });
    expect(resolveAppearance({ theme: "light" }, ["dark", "light"])).toStrictEqual({
      theme: "light",
    });
  });

  it("falls back to the first theme the modeler names", () => {
    expect(resolveAppearance({ theme: "light" }, ["dark"])).toStrictEqual({ theme: "dark" });
  });

  it("lets nothing but the known values through (appearances arrive by postMessage)", () => {
    const foreign = { theme: "system", kontrast: "more" } as unknown as Appearance;
    expect(resolveAppearance(foreign, ["light", "dark"])).toStrictEqual({ theme: "light" });
  });

  it("throws without any theme", () => {
    expect(() => resolveAppearance({ theme: "light" }, [])).toThrow(/at least one theme/);
  });

  it("does not hand out the requested object", () => {
    const requested: Appearance = { theme: "light" };
    expect(resolveAppearance(requested, ["light"])).not.toBe(requested);
  });
});

describe("appearanceFromColorThemeKind", () => {
  it.each([
    [1, { theme: "light" }],
    [2, { theme: "dark" }],
    [3, { theme: "dark", kontrast: "hoch" }],
    [4, { theme: "light", kontrast: "hoch" }],
    [0, { theme: "light" }],
    [5, { theme: "light" }],
    [Number.NaN, { theme: "light" }],
  ])("kind %s → %o", (kind, expected) => {
    expect(appearanceFromColorThemeKind(kind)).toStrictEqual(expected);
  });
});

describe("requestedAppearance", () => {
  it("follows the color theme without a setting or with automatic", () => {
    expect(requestedAppearance(2)).toStrictEqual({ theme: "dark" });
    expect(requestedAppearance(2, "automatic")).toStrictEqual({ theme: "dark" });
    expect(requestedAppearance(3, "automatic")).toStrictEqual({ theme: "dark", kontrast: "hoch" });
  });

  it("lets the setting's theme win, the contrast still from the kind", () => {
    expect(requestedAppearance(2, "light")).toStrictEqual({ theme: "light" });
    expect(requestedAppearance(1, "dark")).toStrictEqual({ theme: "dark" });
    expect(requestedAppearance(3, "light")).toStrictEqual({ theme: "light", kontrast: "hoch" });
    expect(requestedAppearance(4, "dark")).toStrictEqual({ theme: "dark", kontrast: "hoch" });
  });
});

describe("appearanceFromBodyClasses", () => {
  it("reads High Contrast Light before High Contrast (VS Code sets both)", () => {
    expect(
      appearanceFromBodyClasses(["vscode-high-contrast", "vscode-high-contrast-light"]),
    ).toStrictEqual({
      theme: "light",
      kontrast: "hoch",
    });
    expect(
      appearanceFromBodyClasses(["vscode-high-contrast-light", "vscode-high-contrast"]),
    ).toStrictEqual({
      theme: "light",
      kontrast: "hoch",
    });
  });

  it("maps every VS Code body class", () => {
    expect(appearanceFromBodyClasses(["vscode-high-contrast"])).toStrictEqual({
      theme: "dark",
      kontrast: "hoch",
    });
    expect(appearanceFromBodyClasses(["vscode-dark"])).toStrictEqual({ theme: "dark" });
    expect(appearanceFromBodyClasses(["vscode-light"])).toStrictEqual({ theme: "light" });
  });

  it("is undefined without a VS Code class", () => {
    expect(appearanceFromBodyClasses([])).toBeUndefined();
    expect(appearanceFromBodyClasses(["cd-shell-document", "dark"])).toBeUndefined();
  });

  it("takes any iterable, such as a DOMTokenList", () => {
    expect(appearanceFromBodyClasses(new Set(["vscode-dark"]).values())).toStrictEqual({
      theme: "dark",
    });
  });
});

describe("appearanceAttributes", () => {
  it("always writes the theme", () => {
    expect(appearanceAttributes({ theme: "light" })).toStrictEqual({ "data-cd-theme": "light" });
    expect(appearanceAttributes({ theme: "dark" })).toStrictEqual({ "data-cd-theme": "dark" });
  });

  it("adds the contrast only when it is set", () => {
    expect(appearanceAttributes({ theme: "light", kontrast: "hoch" })).toStrictEqual({
      "data-cd-theme": "light",
      "data-cd-kontrast": "hoch",
    });
    expect(Object.keys(appearanceAttributes({ theme: "dark", kontrast: undefined }))).toEqual([
      "data-cd-theme",
    ]);
  });
});

describe("reducedMotionFromBodyClasses", () => {
  it("reads VS Code's vscode-reduce-motion body class", () => {
    expect(reducedMotionFromBodyClasses(["vscode-light", "vscode-reduce-motion"])).toBe(true);
    expect(reducedMotionFromBodyClasses(["vscode-dark"])).toBe(false);
    expect(reducedMotionFromBodyClasses([])).toBe(false);
  });

  it("names the class the shell mirrors on <html>", () => {
    expect(REDUCED_MOTION_CLASS).toBe("cd-shell-reduce-motion");
  });
});
