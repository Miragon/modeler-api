import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SHELL, SHELL_TOKENS, shellSizesFromTokens, type ShellSizeName } from "./sizes.js";

const tokens = JSON.parse(
  readFileSync(new URL("../../fixtures/tokens/cd-tokens.generated.json", import.meta.url), "utf8"),
) as { shell: Record<string, string> };

describe("SHELL drift against the vendored token JSON", () => {
  it("equals the shell group of cd-tokens.generated.json", () => {
    expect(shellSizesFromTokens(tokens.shell)).toEqual(SHELL);
  });

  it("names every shell token of the design system, and only those", () => {
    expect(Object.values(SHELL_TOKENS).sort()).toEqual(Object.keys(tokens.shell).sort());
  });

  it("has a size for every name of SHELL_TOKENS", () => {
    expect(Object.keys(SHELL).sort()).toEqual(Object.keys(SHELL_TOKENS).sort());
  });

  it("keeps the values the guide derives the chrome from", () => {
    expect(SHELL.edge + SHELL.row + SHELL.edge).toBe(SHELL.free);
    expect(SHELL.free + 24).toBe(SHELL.fitInsetTop);
    expect(SHELL.free + SHELL.row + SHELL.edge + 24).toBe(SHELL.fitInsetTopSecondRow);
  });
});

describe("shellSizesFromTokens", () => {
  const without = (token: string): Record<string, string> =>
    Object.fromEntries(Object.entries(tokens.shell).filter(([name]) => name !== token));
  const withValue = (token: string, value: string): Record<string, string> => ({
    ...tokens.shell,
    [token]: value,
  });

  it("reads pixel values and plain layer numbers", () => {
    const sizes = shellSizesFromTokens({
      ...tokens.shell,
      "--cd-shell-rand": "12.5px",
      "--cd-shell-ebene-toast": "61",
    });
    expect(sizes.edge).toBe(12.5);
    expect(sizes.layerToast).toBe(61);
  });

  it.each([
    ["12", 12],
    ["12.", 12],
    ["12.px", 12],
    [".5px", 0.5],
    ["-3", -3],
    ["-.5", -0.5],
    [" 007px ", 7],
  ])("reads %j as %d", (value, expected) => {
    expect(shellSizesFromTokens(withValue("--cd-shell-zeile", value)).row).toBe(expected);
  });

  it.each(Object.entries(SHELL_TOKENS) as [ShellSizeName, string][])(
    "throws when %s (%s) is missing",
    (_, token) => {
      expect(() => shellSizesFromTokens(without(token))).toThrow(token);
    },
  );

  it.each([
    "",
    "px",
    "abc",
    "12em",
    "1rem",
    "calc(12px + 4px)",
    "12 px",
    ".",
    "-",
    "1.2.3",
    "1..2",
  ])("throws on the non-numeric value %j", (value) => {
    expect(() => shellSizesFromTokens(withValue("--cd-shell-zeile", value))).toThrow(
      "--cd-shell-zeile",
    );
  });

  it("rejects a long run of digits with a wrong unit in linear time", () => {
    const value = `${"1".repeat(100_000)}em`;
    const start = performance.now();
    expect(() => shellSizesFromTokens(withValue("--cd-shell-zeile", value))).toThrow(
      "--cd-shell-zeile",
    );
    expect(performance.now() - start).toBeLessThan(200);
  });

  it("ignores tokens it does not know", () => {
    expect(shellSizesFromTokens({ ...tokens.shell, "--cd-shell-new": "7px" })).toEqual(SHELL);
  });
});
