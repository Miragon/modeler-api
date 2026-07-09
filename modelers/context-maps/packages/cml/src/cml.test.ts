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
});
