import { describe, expect, it } from "vitest";
import { parseCml } from "./parser";
import { serializeCml } from "./serializer";
import {
  SAMPLE_DOCUMENT,
  parseDocument,
  validateDocument,
} from "@miragon/context-maps-schema-model";

const CM_EXAMPLE = `
/* A Context Mapper style map */
ContextMap InsuranceContextMap {
  type = SYSTEM_LANDSCAPE
  state = AS_IS

  contains CustomerManagement, PolicyManagement, RiskManagement

  CustomerManagement [U,OHS,PL]->[D,ACL] PolicyManagement {
    implementationTechnology = "RESTful HTTP"
  }
  PolicyManagement [SK]<->[SK] RiskManagement
}
`;

describe("parseCml", () => {
  it("parses contexts and relationships from a CM-style map", () => {
    const { document } = parseCml(CM_EXAMPLE);
    expect(document.title).toBe("InsuranceContextMap");
    expect(document.contexts.map((c) => c.id).sort()).toEqual([
      "CustomerManagement",
      "PolicyManagement",
      "RiskManagement",
    ]);
    expect(document.relationships).toHaveLength(2);

    const ud = document.relationships.find((r) => r.pattern === "upstream-downstream");
    expect(ud?.from).toBe("CustomerManagement");
    expect(ud?.to).toBe("PolicyManagement");
    expect(ud?.upstreamRoles).toEqual(["OHS", "PL"]);
    expect(ud?.downstreamRoles).toEqual(["ACL"]);
    expect(ud?.implementationTechnology).toBe("RESTful HTTP");

    const sk = document.relationships.find((r) => r.pattern === "shared-kernel");
    expect(sk).toBeDefined();
    expect(sk?.upstreamRoles).toBeUndefined();
  });

  it("orients `<-` relationships (right side is upstream)", () => {
    const { document } = parseCml(`
      ContextMap M {
        contains A, B
        A [D,ACL]<-[U,OHS] B
      }
    `);
    const rel = document.relationships[0];
    expect(rel.from).toBe("B");
    expect(rel.to).toBe("A");
    expect(rel.upstreamRoles).toEqual(["OHS"]);
  });

  it("recognises customer-supplier from S/C markers", () => {
    const { document } = parseCml(`
      ContextMap M {
        contains A, B
        A [U,S]->[D,C] B
      }
    `);
    expect(document.relationships[0].pattern).toBe("customer-supplier");
  });

  it("orients `A Customer-Supplier B` (A is the customer/downstream)", () => {
    const { document } = parseCml(`
      ContextMap M {
        contains Orders, Billing
        Orders Customer-Supplier Billing
      }
    `);
    const rel = document.relationships[0];
    expect(rel.pattern).toBe("customer-supplier");
    expect(rel.from).toBe("Billing");
    expect(rel.to).toBe("Orders");
  });

  it("orients `A Supplier-Customer B` (A is the supplier/upstream)", () => {
    const { document } = parseCml(`
      ContextMap M {
        contains Orders, Billing
        Billing Supplier-Customer Orders
      }
    `);
    const rel = document.relationships[0];
    expect(rel.pattern).toBe("customer-supplier");
    expect(rel.from).toBe("Billing");
    expect(rel.to).toBe("Orders");
  });

  it("orients the Upstream-Downstream and Downstream-Upstream keyword forms", () => {
    const { document } = parseCml(`
      ContextMap M {
        contains A, B, C
        A Upstream-Downstream B
        C Downstream-Upstream A
      }
    `);
    expect(document.relationships[0]).toMatchObject({
      from: "A",
      to: "B",
      pattern: "upstream-downstream",
    });
    expect(document.relationships[1]).toMatchObject({
      from: "A",
      to: "C",
      pattern: "upstream-downstream",
    });
  });

  it("recovers Separate Ways from serializer comments", () => {
    const { document } = parseCml(`
      ContextMap M {
        contains A, B
        // Separate Ways: A and B
      }
    `);
    expect(document.relationships).toHaveLength(1);
    expect(document.relationships[0]).toMatchObject({
      from: "A",
      to: "B",
      pattern: "separate-ways",
    });
  });

  it("warns about unknown bracket roles instead of dropping them silently", () => {
    const { document, diagnostics } = parseCml(`
      ContextMap M {
        contains A, B
        A [U,BAD]->[D,ACL] B
      }
    `);
    expect(document.relationships[0].upstreamRoles).toBeUndefined();
    expect(document.relationships[0].downstreamRoles).toEqual(["ACL"]);
    expect(diagnostics).toEqual([
      expect.objectContaining({ severity: "warning", message: expect.stringContaining("BAD") }),
    ]);
  });

  it("produces a structurally valid, semantically clean document", () => {
    const { document } = parseCml(CM_EXAMPLE);
    expect(parseDocument(document).ok).toBe(true);
    const report = validateDocument(document);
    expect(report.errors).toEqual([]);
  });
});

describe("serializeCml + round-trip", () => {
  it("emits a ContextMap block with contains and relationships", () => {
    const cml = serializeCml(SAMPLE_DOCUMENT);
    expect(cml).toContain("ContextMap ConferenceEventPlannerContextMap {");
    expect(cml).toContain("contains ");
    expect(cml).toContain("]->[");
    expect(cml).toContain("[SK]<->[SK]");
  });

  it("round-trips through CML preserving contexts and relationship patterns", () => {
    const cml = serializeCml(SAMPLE_DOCUMENT);
    const { document } = parseCml(cml);
    expect(document.contexts).toHaveLength(SAMPLE_DOCUMENT.contexts.length);

    const patternsBefore = SAMPLE_DOCUMENT.relationships.map((r) => r.pattern).sort();
    const patternsAfter = document.relationships.map((r) => r.pattern).sort();
    expect(patternsAfter).toEqual(patternsBefore);

    const report = validateDocument(document);
    expect(report.errors).toEqual([]);
  });

  it("round-trips separate-ways via the comment marker", () => {
    const doc = structuredClone(SAMPLE_DOCUMENT);
    doc.relationships.push({
      id: "rel_sw",
      from: "ctx_auth",
      to: "ctx_notification",
      pattern: "separate-ways",
    });
    const { document } = parseCml(serializeCml(doc));
    const sw = document.relationships.filter((r) => r.pattern === "separate-ways");
    expect(sw).toHaveLength(1);
    expect(sw[0].from).toBe("CtxAuth");
    expect(sw[0].to).toBe("CtxNotification");
  });
});
