import { describe, expect, it } from "vitest";
import { parseDocument, parseDocumentText } from "./schema";
import { serializeDocument, serializeDocumentText } from "./serialize";
import { SAMPLE_DOCUMENT } from "./sample";

const FOREIGN_TEXT = `{
  "version": 1,
  "title": "Vendor map",
  "x-vendor": { "owner": "team-a", "tags": ["b", "a"] },
  "contexts": [
    {
      "id": "a",
      "label": "A",
      "position": { "x": 0, "y": 0 },
      "size": { "width": 200, "height": 110 },
      "zeta": 1,
      "alpha": "kept"
    },
    { "id": "b", "label": "B", "position": { "x": 300, "y": 0 }, "size": { "width": 200, "height": 110 } }
  ],
  "relationships": [
    { "id": "r", "from": "a", "to": "b", "pattern": "partnership", "x-weight": 3 }
  ],
  "__proto__": { "polluted": true }
}
`;

describe("foreign keys (L6: kept, never dropped)", () => {
  it("keeps unknown keys of the document, its contexts and its relationships", () => {
    const parsed = parseDocumentText(FOREIGN_TEXT);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const json = JSON.parse(serializeDocument(parsed.document)) as Record<string, unknown>;
    expect(json["x-vendor"]).toEqual({ owner: "team-a", tags: ["b", "a"] });
    const [context] = json.contexts as Array<Record<string, unknown>>;
    expect(context).toMatchObject({ zeta: 1, alpha: "kept" });
    const [relationship] = json.relationships as Array<Record<string, unknown>>;
    expect(relationship["x-weight"]).toBe(3);
  });

  it("writes them after the known keys, sorted by name", () => {
    const parsed = parseDocumentText(FOREIGN_TEXT);
    if (!parsed.ok) throw new Error(parsed.error);
    const json = JSON.parse(serializeDocument(parsed.document)) as Record<string, unknown>;
    expect(Object.keys(json)).toEqual([
      "version",
      "title",
      "contexts",
      "relationships",
      "__proto__",
      "x-vendor",
    ]);
    const [context] = json.contexts as Array<Record<string, unknown>>;
    expect(Object.keys(context!)).toEqual(["id", "label", "position", "size", "alpha", "zeta"]);
  });

  it("keeps a key named __proto__ as a field and never as the prototype", () => {
    const parsed = parseDocumentText(FOREIGN_TEXT);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(Object.getPrototypeOf(parsed.document)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(serializeDocumentText(parsed.document)).toContain('"__proto__": {');
  });

  it("is a fixpoint: the canonical text parses and serialises to itself", () => {
    const parsed = parseDocumentText(FOREIGN_TEXT);
    if (!parsed.ok) throw new Error(parsed.error);
    const canonical = serializeDocumentText(parsed.document);
    const again = parseDocumentText(canonical);
    if (!again.ok) throw new Error(again.error);
    expect(serializeDocumentText(again.document)).toBe(canonical);
  });

  it("parsing an already parsed document keeps its foreign keys as they are", () => {
    const parsed = parseDocumentText(FOREIGN_TEXT);
    if (!parsed.ok) throw new Error(parsed.error);
    const reparsed = parseDocument(parsed.document);
    if (!reparsed.ok) throw new Error(reparsed.error);
    expect(serializeDocument(reparsed.document)).toBe(serializeDocument(parsed.document));
  });
});

describe("document text", () => {
  it("ends in exactly one line break", () => {
    const text = serializeDocumentText(SAMPLE_DOCUMENT);
    expect(text.endsWith("}\n")).toBe(true);
    expect(text.endsWith("\n\n")).toBe(false);
  });

  it("reads an empty file as an empty document", () => {
    const parsed = parseDocumentText("  \n");
    expect(parsed.ok && parsed.document.contexts).toEqual([]);
  });

  it("reads a file with a byte order mark", () => {
    const parsed = parseDocumentText(`\uFEFF${serializeDocumentText(SAMPLE_DOCUMENT)}`);
    expect(parsed.ok).toBe(true);
  });

  it("rejects text that is not JSON, a list and a cut-off file", () => {
    const text = serializeDocumentText(SAMPLE_DOCUMENT);
    expect(parseDocumentText("[]").ok).toBe(false);
    expect(parseDocumentText(text.slice(0, text.length / 2)).ok).toBe(false);
    expect(parseDocumentText(`${text}\u0000`).ok).toBe(false);
  });
});

describe("versions and bounds", () => {
  it("rejects a document of a newer version instead of rewriting it as version 1", () => {
    const result = parseDocument({ version: 2, title: "t", contexts: [], relationships: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("newer");
  });

  it("rejects coordinates and sizes beyond a million pixels", () => {
    const at = (x: number, width = 200) => ({
      version: 1,
      title: "t",
      contexts: [{ id: "a", label: "A", position: { x, y: 0 }, size: { width, height: 100 } }],
      relationships: [],
    });
    expect(parseDocument(at(999_999)).ok).toBe(true);
    expect(parseDocument(at(1e38)).ok).toBe(false);
    expect(parseDocument(at(-1e38)).ok).toBe(false);
    expect(parseDocument(at(0, 1e7)).ok).toBe(false);
  });
});

describe("parse issues", () => {
  it("name the path of every invalid value", () => {
    const result = parseDocument({
      version: 1,
      title: "t",
      contexts: [
        { id: "a", label: "A", position: { x: "left", y: 0 }, size: { width: 10, height: 10 } },
      ],
      relationships: [{ id: "r", from: "a", to: "b", pattern: "bogus" }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues?.map((issue) => issue.path)).toEqual([
      ["contexts", 0, "position", "x"],
      ["relationships", 0, "pattern"],
    ]);
  });

  it("point at the whole text for a syntax error and at the version for a newer one", () => {
    const syntax = parseDocumentText("{");
    const newer = parseDocument({ version: 3 });
    expect(!syntax.ok && syntax.issues?.[0]?.path).toEqual([]);
    expect(!newer.ok && newer.issues?.[0]?.path).toEqual(["version"]);
  });
});
