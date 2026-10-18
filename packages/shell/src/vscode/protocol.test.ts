import { describe, expect, it } from "vitest";

import * as extension from "./extension/index.js";
import { APPEARANCE_MESSAGE_TYPE, appearanceMessage, isAppearanceMessage } from "./protocol.js";
import * as webview from "./webview/index.js";

describe("appearanceMessage", () => {
  it("wraps the appearance under the shell's message type", () => {
    expect(APPEARANCE_MESSAGE_TYPE).toBe("modelerShell.appearance");
    expect(appearanceMessage({ theme: "dark", kontrast: "hoch" })).toEqual({
      type: "modelerShell.appearance",
      appearance: { theme: "dark", kontrast: "hoch" },
    });
  });

  it("carries no kontrast key without high contrast, so it survives JSON unchanged", () => {
    const sent = appearanceMessage({ theme: "light", kontrast: undefined });
    expect(Object.keys(sent.appearance)).toEqual(["theme"]);
    expect(JSON.parse(JSON.stringify(sent))).toEqual(sent);
  });

  it("copies the appearance", () => {
    const appearance = { theme: "light" as const };
    expect(appearanceMessage(appearance).appearance).not.toBe(appearance);
  });
});

describe("isAppearanceMessage", () => {
  it("accepts what appearanceMessage builds", () => {
    expect(isAppearanceMessage(appearanceMessage({ theme: "light" }))).toBe(true);
    expect(isAppearanceMessage(appearanceMessage({ theme: "dark" }))).toBe(true);
    expect(isAppearanceMessage(appearanceMessage({ theme: "light", kontrast: "hoch" }))).toBe(true);
    expect(isAppearanceMessage(JSON.parse(JSON.stringify(appearanceMessage({ theme: "dark" }))))).toBe(true);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a string", "modelerShell.appearance"],
    ["an array", [APPEARANCE_MESSAGE_TYPE, { theme: "light" }]],
    ["another message", { type: "command", name: "fitView" }],
    ["a message without appearance", { type: APPEARANCE_MESSAGE_TYPE }],
    ["a null appearance", { type: APPEARANCE_MESSAGE_TYPE, appearance: null }],
    ["an unknown theme", { type: APPEARANCE_MESSAGE_TYPE, appearance: { theme: "system" } }],
    ["a missing theme", { type: APPEARANCE_MESSAGE_TYPE, appearance: { kontrast: "hoch" } }],
    [
      "an unknown kontrast",
      { type: APPEARANCE_MESSAGE_TYPE, appearance: { theme: "light", kontrast: "high" } },
    ],
  ])("rejects %s", (_name, value) => {
    expect(isAppearanceMessage(value)).toBe(false);
  });
});

describe("shared protocol", () => {
  it("is the same in the extension and the webview entry", () => {
    expect(extension.APPEARANCE_MESSAGE_TYPE).toBe(webview.APPEARANCE_MESSAGE_TYPE);
    expect(extension.appearanceMessage).toBe(webview.appearanceMessage);
    expect(extension.isAppearanceMessage).toBe(webview.isAppearanceMessage);
  });
});
