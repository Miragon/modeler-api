import { beforeEach, describe, expect, it } from "vitest";
import { SAMPLE_DOCUMENT, serializeDocument } from "@miragon/context-maps-schema-model";
import {
  loadFromStorage,
  readLegendOpen,
  saveToStorage,
  writeLegendOpen,
} from "../src/state/persistence";

beforeEach(() => localStorage.clear());

describe("the browser's copy of the map", () => {
  it("keeps the map as it was saved", () => {
    expect(saveToStorage(SAMPLE_DOCUMENT)).toBe("saved");
    expect(serializeDocument(loadFromStorage()!)).toBe(serializeDocument(SAMPLE_DOCUMENT));
  });

  it("restores nothing from a missing or corrupted copy", () => {
    expect(loadFromStorage()).toBeNull();
    localStorage.setItem("cm-modeler:document:v1", '{"version": 1, "contexts": [');
    expect(loadFromStorage()).toBeNull();
  });
});

describe("the legend state", () => {
  it("is unknown before the first toggle and then follows it", () => {
    expect(readLegendOpen()).toBeUndefined();
    writeLegendOpen(false);
    expect(readLegendOpen()).toBe(false);
    writeLegendOpen(true);
    expect(readLegendOpen()).toBe(true);
  });
});
