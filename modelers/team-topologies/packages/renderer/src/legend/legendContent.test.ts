// @vitest-environment node
import { describe, expect, it } from "vitest";
import { legendGroups } from "./legendContent.js";

// A host that draws the legend itself (a native panel, a server-rendered page) takes the rows as
// data, so building them must not need a browser.
describe("legendGroups without a DOM", () => {
  it("builds every row as plain data with SVG markup", () => {
    expect(typeof document).toBe("undefined");
    const rows = legendGroups().flatMap((group) => group.rows);
    expect(rows).toHaveLength(9);
    for (const row of rows) {
      expect(row.preview).toMatch(/^<svg\b[\s\S]*<\/svg>$/);
      expect(row.label).not.toBe("");
      expect(row.explanation).not.toBe("");
    }
  });
});
