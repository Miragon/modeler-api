import { describe, expect, it } from "vitest";
import type { CmDocument } from "@miragon/context-maps-schema-model";
import { importNotes, importNotesText, mapProblems } from "../src/problems";

const context = (id: string, label: string) => ({
  id,
  label,
  position: { x: 0, y: 0 },
  size: { width: 200, height: 110 },
});

const MAP: CmDocument = {
  version: 1,
  title: "Findings",
  contexts: [context("ordering", "Ordering"), context("billing", "Billing")],
  relationships: [
    {
      id: "rel_cs",
      from: "ordering",
      to: "billing",
      pattern: "customer-supplier",
      downstreamRoles: ["ACL"],
    },
    {
      id: "rel_partner",
      from: "billing",
      to: "ordering",
      pattern: "partnership",
      upstreamRoles: ["OHS"],
    },
  ],
};

describe("mapProblems", () => {
  it("lists errors before warnings, each placed on its relationship's ends", () => {
    expect(mapProblems(MAP, () => true)).toEqual([
      {
        severity: "error",
        message: expect.stringContaining("one relationship"),
        location: "“Billing” ↔ “Ordering”",
        elementId: "rel_partner",
      },
      {
        severity: "error",
        message: expect.stringContaining("symmetric partnership"),
        location: "“Billing” ↔ “Ordering”",
        elementId: "rel_partner",
      },
      {
        severity: "warning",
        message: expect.stringContaining("ACL"),
        location: "“Ordering” → “Billing”",
        elementId: "rel_cs",
      },
    ]);
  });

  it("selects only relationships the canvas draws", () => {
    const items = mapProblems(MAP, (id) => id === "rel_cs");
    expect(items.map((item) => item.elementId)).toEqual([undefined, undefined, "rel_cs"]);
  });

  it("finds nothing in a clean map", () => {
    expect(mapProblems({ ...MAP, relationships: [] }, () => true)).toEqual([]);
  });
});

describe("import notes", () => {
  it("are warnings placed in the file they came from", () => {
    expect(importNotes("shop.cml", ["Unknown role"])).toEqual([
      { severity: "warning", message: "Unknown role", location: "shop.cml" },
    ]);
  });

  it("point at the pill in singular and plural", () => {
    expect(importNotesText(1, "1 problem")).toBe(
      "Imported with 1 warning. Details under “1 problem” bottom left.",
    );
    expect(importNotesText(2, "3 problems")).toBe(
      "Imported with 2 warnings. Details under “3 problems” bottom left.",
    );
  });
});
