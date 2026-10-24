import { describe, expect, it } from "vitest";
import { canonicalize, serializeDocument } from "./serialize";
import { SAMPLE_DOCUMENT } from "./sample";
import type { CmDocument } from "./types";

describe("serialize", () => {
  it("rounds coordinates and sizes to 2 decimals", () => {
    const doc: CmDocument = {
      version: 1,
      title: "t",
      contexts: [
        {
          id: "a",
          label: "A",
          position: { x: 10.123456, y: -3.98765 },
          size: { width: 100.005, height: 50.004 },
        },
      ],
      relationships: [],
    };
    const c = canonicalize(doc);
    expect(c.contexts[0].position).toEqual({ x: 10.12, y: -3.99 });
    expect(c.contexts[0].size).toEqual({ width: 100.01, height: 50 });
  });

  it("sorts contexts and relationships by id deterministically", () => {
    const doc: CmDocument = {
      version: 1,
      title: "t",
      contexts: [
        { id: "z", label: "Z", position: { x: 0, y: 0 }, size: { width: 1, height: 1 } },
        { id: "a", label: "A", position: { x: 0, y: 0 }, size: { width: 1, height: 1 } },
      ],
      relationships: [
        { id: "r2", from: "a", to: "z", pattern: "partnership" },
        { id: "r1", from: "z", to: "a", pattern: "separate-ways" },
      ],
    };
    const c = canonicalize(doc);
    expect(c.contexts.map((n) => n.id)).toEqual(["a", "z"]);
    expect(c.relationships.map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  it("produces byte-identical output across runs", () => {
    expect(serializeDocument(SAMPLE_DOCUMENT)).toBe(serializeDocument(SAMPLE_DOCUMENT));
  });

  it("omits undefined optional fields", () => {
    const json = serializeDocument(SAMPLE_DOCUMENT);
    const parsed = JSON.parse(json) as CmDocument;
    const cfp = parsed.contexts.find((c) => c.id === "ctx_cfp");
    expect(cfp && "fill" in cfp).toBe(false);
  });
});
