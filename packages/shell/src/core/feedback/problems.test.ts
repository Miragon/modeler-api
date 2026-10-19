import { describe, expect, it } from "vitest";
import { problemSummary, type ProblemItem } from "./problems.js";

describe("problemSummary", () => {
  it("counts the items and the errors among them", () => {
    const items: ProblemItem[] = [
      { severity: "error", message: "Unknown sticky type “evnt”.", location: "Line 12" },
      { severity: "warning", message: "A box without a name.", elementId: "Box_2" },
      { severity: "error", message: "Arrow to nowhere.", location: "Line 14" },
    ];
    const summary = problemSummary(items);
    expect(summary).toEqual({ count: 3, errors: 2, items });
    expect(summary.items).toBe(items);
  });

  it("is zero for no items and for warnings only", () => {
    expect(problemSummary([])).toEqual({ count: 0, errors: 0, items: [] });
    expect(problemSummary([{ severity: "warning", message: "Unused." }])).toMatchObject({
      count: 1,
      errors: 0,
    });
  });
});
