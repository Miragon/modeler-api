import { describe, expect, it } from "vitest";

import { shortcutChipProblems } from "./key-shortcut-checks.js";

describe("shortcutChipProblems", () => {
  it.each([
    ["L", "L"],
    ["⌘O", "Meta+O"],
    ["⇧1", "Shift+1"],
    ["?", "Shift+/ Shift+ß"],
    ["/", "/ Shift+7"],
    ["#", "Shift+3 #"],
    ["!", "Shift+1"],
    ["⌘+", "Meta+= Meta+Plus"],
    ["Ctrl+Plus", "Control+= Control+Plus"],
    ["⌘−", "Meta+-"],
    ["G then D", "G D"],
    ["⌘⏎", "Control+Enter Meta+Enter"],
  ])("accepts the chip %j with %j", (chip, value) => {
    expect(shortcutChipProblems("x", chip, value)).toEqual([]);
  });

  it.each([
    ["⌘+", "Meta+Plus"],
    ["Ctrl+Plus", "Control+Plus"],
    ["Ctrl++", "Control+Shift+= Control+Plus"],
  ])("wants the zoom-in chip %j to name the zoom panel's keys, not %j", (chip, value) => {
    const command = chip.startsWith("⌘") ? "Meta" : "Control";
    expect(shortcutChipProblems("x", chip, value)).toEqual([
      `x has aria-keyshortcuts="${value}" for the chip "${chip}", expected "${command}+= ${command}+Plus": the keys of the US, then the German layout (guide §5.6)`,
    ]);
  });

  it.each(["?", "Shift+?", "Meta+Shift+?", "!", "Shift+1 %", "_", "@", "Control+{", "~", "Meta++"])(
    "rejects %j, which names a character no key of the US or German layout types alone",
    (value) => {
      expect(shortcutChipProblems("x", "", value)).toEqual([
        expect.stringMatching(
          /^x has aria-keyshortcuts=".*", which names the character ".", not a key \(guide §5\.6\)$/,
        ),
      ]);
    },
  );

  it.each(["Equal", "Meta+Slash", "KeyA", "Shift+Digit1", "Control+NumpadAdd"])(
    "rejects %j, a KeyboardEvent code instead of a key name",
    (value) => {
      expect(shortcutChipProblems("x", "", value)).toEqual([
        `x has aria-keyshortcuts="${value}", a KeyboardEvent code; name the key as WAI-ARIA does (guide §5.6)`,
      ]);
    },
  );

  it("wants the two-layout value on a chip whose character needs ⇧, not the chip as description", () => {
    expect(shortcutChipProblems("x", "?", null)).toEqual([
      'x has no aria-keyshortcuts for the chip "?", expected "Shift+/ Shift+ß": the keys of the US, then the German layout (guide §5.6)',
    ]);
    expect(shortcutChipProblems("x", "⌘+", "")).toEqual([
      'x has no aria-keyshortcuts for the chip "⌘+", expected "Meta+= Meta+Plus": the keys of the US, then the German layout (guide §5.6)',
    ]);
  });

  it.each(["L", "⌘O", "G then D", "⌘⏎", ""])(
    "leaves a chip %j without aria-keyshortcuts to its caller",
    (chip) => {
      expect(shortcutChipProblems("x", chip, null)).toEqual([]);
    },
  );

  it.each([
    ["@", null],
    ["@", "Shift+2"],
    ["[", "["],
    ["⌘ä", null],
    ["ß", "ß"],
    ["^", null],
  ])(
    "rejects the chip %j (aria-keyshortcuts %j), as guide §5.6 rules out its character",
    (chip, value) => {
      expect(shortcutChipProblems("x", chip, value)).toEqual([
        `x shows the shortcut "${chip}" on a character that needs AltGr or ⌥, sits on a dead key or is missing on the US or the German layout; guide §5.6 rules such a shortcut out`,
      ]);
    },
  );
});
