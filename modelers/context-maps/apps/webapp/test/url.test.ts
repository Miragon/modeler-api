import { describe, expect, it } from "vitest";
import {
  buildShareUrl,
  decodeDocumentFromHash,
  encodeDocumentToHash,
  hashHoldsDocument,
} from "../src/io/url";
import { serializeDocument } from "@miragon/context-maps-schema-model";
import { SAMPLE_DOCUMENT } from "@miragon/context-maps-schema-model";

describe("url sharing", () => {
  it("round-trips a document through the hash payload", () => {
    const encoded = encodeDocumentToHash(SAMPLE_DOCUMENT);
    const decoded = decodeDocumentFromHash(`#d=${encoded}`);
    expect(decoded).not.toBeNull();
    expect(serializeDocument(decoded!)).toBe(serializeDocument(SAMPLE_DOCUMENT));
  });

  it("builds a share url containing the payload", () => {
    const url = buildShareUrl(SAMPLE_DOCUMENT, "https://example.com/app");
    expect(url.startsWith("https://example.com/app#d=")).toBe(true);
  });

  it("returns null for an empty or malformed hash", () => {
    expect(decodeDocumentFromHash("")).toBeNull();
    expect(decodeDocumentFromHash("#d=not-valid-lz")).toBeNull();
    expect(decodeDocumentFromHash("#other=1")).toBeNull();
  });

  it("tells a link that carries a map, readable or not, from one that carries none", () => {
    expect(hashHoldsDocument(`#d=${encodeDocumentToHash(SAMPLE_DOCUMENT)}`)).toBe(true);
    expect(hashHoldsDocument("#d=!!!cut-off")).toBe(true);
    expect(hashHoldsDocument("")).toBe(false);
    expect(hashHoldsDocument("#other=1")).toBe(false);
  });
});
