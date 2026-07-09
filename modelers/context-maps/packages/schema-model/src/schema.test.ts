import { describe, expect, it } from "vitest";
import { parseDocument, validateDocument } from "./schema";
import { SAMPLE_DOCUMENT } from "./sample";
import { emptyDocument } from "./factory";
import type { CmDocument, Relationship } from "./types";

describe("parseDocument", () => {
  it("accepts the sample document", () => {
    const result = parseDocument(SAMPLE_DOCUMENT);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.contexts).toHaveLength(6);
      expect(result.document.relationships).toHaveLength(6);
    }
  });

  it("fills in defaults for a sparse object (migration)", () => {
    const result = parseDocument({ contexts: [] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.version).toBe(1);
      expect(typeof result.document.title).toBe("string");
      expect(result.document.relationships).toEqual([]);
    }
  });

  it("rejects an invalid subdomain type", () => {
    const result = parseDocument({
      version: 1,
      title: "x",
      contexts: [
        {
          id: "a",
          label: "A",
          subdomainType: "not-a-subdomain",
          position: { x: 0, y: 0 },
          size: { width: 10, height: 10 },
        },
      ],
      relationships: [],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid relationship pattern", () => {
    const result = parseDocument({
      version: 1,
      title: "x",
      contexts: [],
      relationships: [{ id: "r", from: "a", to: "b", pattern: "bogus" }],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-object", () => {
    expect(parseDocument(42).ok).toBe(false);
    expect(parseDocument(null).ok).toBe(false);
  });
});

// Helper: a valid two-context map plus one relationship under test.
function mapWith(rel: Partial<Relationship>): CmDocument {
  const doc = emptyDocument("t");
  doc.contexts = [
    { id: "a", label: "A", position: { x: 0, y: 0 }, size: { width: 10, height: 10 } },
    { id: "b", label: "B", position: { x: 50, y: 0 }, size: { width: 10, height: 10 } },
  ];
  doc.relationships = [{ id: "r", from: "a", to: "b", pattern: "upstream-downstream", ...rel }];
  return doc;
}

describe("validateDocument — the 13 semantic rules", () => {
  it("reports no findings for the (valid) sample map", () => {
    const report = validateDocument(SAMPLE_DOCUMENT);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  it("rule 1/2: valid upstream/downstream roles pass", () => {
    const report = validateDocument(mapWith({ upstreamRoles: ["OHS"], downstreamRoles: ["ACL"] }));
    expect(report.errors).toEqual([]);
  });

  it("rule 3: ACL and CF cannot be combined", () => {
    const report = validateDocument(mapWith({ downstreamRoles: ["ACL", "CF"] }));
    expect(report.errors.some((e) => e.rule === "protect-or-conform")).toBe(true);
  });

  it("rule 4: symmetric patterns must not carry roles", () => {
    const report = validateDocument(mapWith({ pattern: "shared-kernel", upstreamRoles: ["OHS"] }));
    expect(report.errors.some((e) => e.rule === "symmetric-integrity")).toBe(true);
  });

  it("rule 5: CF is invalid in a customer-supplier relationship", () => {
    const report = validateDocument(
      mapWith({ pattern: "customer-supplier", downstreamRoles: ["CF"] }),
    );
    expect(report.errors.some((e) => e.rule === "customer-vs-conformist")).toBe(true);
  });

  it("rule 6: OHS is invalid in a customer-supplier relationship", () => {
    const report = validateDocument(
      mapWith({ pattern: "customer-supplier", upstreamRoles: ["OHS"] }),
    );
    expect(report.errors.some((e) => e.rule === "generic-vs-custom-service")).toBe(true);
  });

  it("rule 7: ACL in customer-supplier is a warning, not an error", () => {
    const report = validateDocument(
      mapWith({ pattern: "customer-supplier", downstreamRoles: ["ACL"] }),
    );
    expect(report.errors).toEqual([]);
    expect(report.warnings.some((w) => w.rule === "protect-or-cooperate")).toBe(true);
  });

  it("rule 8: endpoints must be contexts on the map", () => {
    const report = validateDocument(mapWith({ to: "ghost" }));
    expect(report.errors.some((e) => e.rule === "endpoints-on-map")).toBe(true);
  });

  it("rule 9: no self-relationship", () => {
    const report = validateDocument(mapWith({ from: "a", to: "a" }));
    expect(report.errors.some((e) => e.rule === "no-self-relationship")).toBe(true);
  });

  it("rule 10: ids must be unique across contexts and relationships", () => {
    const doc = mapWith({});
    doc.relationships[0].id = "a"; // collides with context "a"
    const report = validateDocument(doc);
    expect(report.errors.some((e) => e.rule === "unique-ids")).toBe(true);
  });

  it("rule 11: a core domain conforming (CF) to another context is warned", () => {
    const doc = mapWith({ downstreamRoles: ["CF"] });
    doc.contexts[1].subdomainType = "core";
    const report = validateDocument(doc);
    expect(report.errors).toEqual([]);
    expect(report.warnings.some((w) => w.rule === "protect-the-core")).toBe(true);
  });

  it("rule 11: CF on a non-core downstream context stays clean", () => {
    const doc = mapWith({ downstreamRoles: ["CF"] });
    doc.contexts[1].subdomainType = "generic";
    const report = validateDocument(doc);
    expect(report.warnings).toEqual([]);
  });

  it("rule 12: a shared kernel across two teams is warned", () => {
    const doc = mapWith({ pattern: "shared-kernel" });
    doc.contexts[0].team = "Team Red";
    doc.contexts[1].team = "Team Blue";
    const report = validateDocument(doc);
    expect(report.errors).toEqual([]);
    expect(report.warnings.some((w) => w.rule === "shared-kernel-team-coupling")).toBe(true);
  });

  it("rule 12: a shared kernel within one team (or without teams) stays clean", () => {
    const sameTeam = mapWith({ pattern: "shared-kernel" });
    sameTeam.contexts[0].team = "Team Red";
    sameTeam.contexts[1].team = "Team Red";
    expect(validateDocument(sameTeam).warnings).toEqual([]);

    const noTeams = mapWith({ pattern: "shared-kernel" });
    expect(validateDocument(noTeams).warnings).toEqual([]);
  });

  it("rule 13: two relationships between the same pair are an error (either direction)", () => {
    const doc = mapWith({});
    doc.relationships.push({ id: "r2", from: "b", to: "a", pattern: "partnership" });
    const report = validateDocument(doc);
    const finding = report.errors.find((e) => e.rule === "one-relationship-per-pair");
    expect(finding).toBeDefined();
    expect(finding?.relationshipId).toBe("r2");
  });

  it("rule 13: distinct pairs stay clean", () => {
    const doc = mapWith({});
    doc.contexts.push({
      id: "c",
      label: "C",
      position: { x: 100, y: 0 },
      size: { width: 10, height: 10 },
    });
    doc.relationships.push({ id: "r2", from: "b", to: "c", pattern: "upstream-downstream" });
    expect(validateDocument(doc).errors).toEqual([]);
  });
});
