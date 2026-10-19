import { describe, expect, it } from "vitest";
import { minimalLineEdit } from "../src/textLines.js";

describe("minimalLineEdit", () => {
  it("touches only the lines that changed", () => {
    const edit = minimalLineEdit("a\nb\nc\n", "a\nB\nc\n");
    expect(edit).toEqual({
      start: { line: 1, character: 0 },
      end: { line: 2, character: 0 },
      text: "B\n",
    });
  });

  it("is undefined when only the line break style differs", () => {
    expect(minimalLineEdit("a\r\nb\r\n", "a\nb\n")).toBeUndefined();
  });

  it("anchors a change of the last line at the end of the previous one", () => {
    expect(minimalLineEdit("a\nb", "a\nc")).toEqual({
      start: { line: 0, character: 1 },
      end: { line: 1, character: 1 },
      text: "\nc",
    });
  });

  it("replaces everything from the start when the first line changes up to the end", () => {
    expect(minimalLineEdit("x", "y\nz")).toEqual({
      start: { line: 0, character: 0 },
      end: { line: 0, character: 1 },
      text: "y\nz",
    });
  });
});
