import { describe, expect, it } from "vitest";

import { acceptsFile, dragVerdict, type DragContext, type DragItemLike } from "./drop.js";

const file = (type = ""): DragItemLike => ({ kind: "file", type });
const text: DragItemLike = { kind: "string", type: "text/plain" };

const context = (overrides: Partial<DragContext> = {}): DragContext => ({
  accept: [".storm", ".json", "application/json", "text/*"],
  multiple: false,
  dialogOpen: false,
  ...overrides,
});

describe("dragVerdict (guide §9)", () => {
  it("stays out of drags without a file", () => {
    expect(dragVerdict([], context())).toEqual({ state: "none" });
    expect(dragVerdict([text], context())).toEqual({ state: "none" });
    expect(dragVerdict([text], context({ dialogOpen: true }))).toEqual({ state: "none" });
  });

  it("shows one acceptable file as over", () => {
    expect(dragVerdict([file()], context())).toEqual({ state: "over" });
    expect(dragVerdict([file("application/json")], context())).toEqual({ state: "over" });
    expect(dragVerdict([file("text/plain")], context())).toEqual({ state: "over" });
    expect(dragVerdict([text, file("application/json")], context())).toEqual({ state: "over" });
  });

  it("forbids every drop while a modal dialog is open", () => {
    expect(dragVerdict([file()], context({ dialogOpen: true }))).toEqual({
      state: "forbidden",
      reason: "dialog",
    });
  });

  it("forbids more than one file without multiple", () => {
    expect(dragVerdict([file(), file()], context())).toEqual({ state: "forbidden", reason: "multiple" });
    expect(dragVerdict([file(), file()], context({ multiple: true }))).toEqual({ state: "over" });
    // the string items of a file drag do not count as files
    expect(dragVerdict([file(), text, text], context())).toEqual({ state: "over" });
  });

  it("forbids a type that none of the MIME entries matches", () => {
    expect(dragVerdict([file("image/png")], context())).toEqual({ state: "forbidden", reason: "type" });
    expect(dragVerdict([file("IMAGE/PNG")], context())).toEqual({ state: "forbidden", reason: "type" });
    expect(dragVerdict([file("image/png"), file("application/pdf")], context({ multiple: true }))).toEqual({
      state: "forbidden",
      reason: "type",
    });
  });

  it("never forbids an empty type, nor a drag with one matching file", () => {
    expect(dragVerdict([file("")], context({ accept: ["application/json"] }))).toEqual({ state: "over" });
    expect(dragVerdict([file("image/png"), file("")], context({ multiple: true }))).toEqual({
      state: "over",
    });
    expect(dragVerdict([file("image/png"), file("application/json")], context({ multiple: true }))).toEqual({
      state: "over",
    });
  });

  it("checks the type only when accept lists a MIME type", () => {
    expect(dragVerdict([file("image/png")], context({ accept: [".storm", ".json"] }))).toEqual({
      state: "over",
    });
    expect(dragVerdict([file("image/png")], context({ accept: [] }))).toEqual({ state: "over" });
  });

  it("decides dialog before multiple before type", () => {
    const twoImages = [file("image/png"), file("image/gif")];
    expect(dragVerdict(twoImages, context({ dialogOpen: true }))).toEqual({
      state: "forbidden",
      reason: "dialog",
    });
    expect(dragVerdict(twoImages, context())).toEqual({ state: "forbidden", reason: "multiple" });
    expect(dragVerdict(twoImages, context({ multiple: true }))).toEqual({
      state: "forbidden",
      reason: "type",
    });
  });
});

describe("acceptsFile (like <input accept>)", () => {
  const accept = [".storm", ".JSON", "text/*", "application/xml"];

  it.each([
    ["board.storm", "", true],
    ["BOARD.STORM", "", true],
    ["board.json", "application/json", true],
    ["notes.txt", "text/plain", true],
    ["notes.md", "TEXT/MARKDOWN", true],
    ["model.xml", "application/xml", true],
    ["model.bpmn", "application/xml", true],
    ["map.png", "image/png", false],
    ["board.storm.bak", "", false],
    ["storm", "", false],
    ["data.xml", "application/xml-dtd", false],
    ["image.png", "", false],
  ])("%s (%s): %s", (name, type, expected) => {
    expect(acceptsFile({ name, type }, accept)).toBe(expected);
  });

  it("accepts every file with an empty accept", () => {
    expect(acceptsFile({ name: "map.png", type: "image/png" }, [])).toBe(true);
    expect(acceptsFile({ name: "anything", type: "" }, [" "])).toBe(true);
  });

  it("matches an empty type against no MIME entry", () => {
    expect(acceptsFile({ name: "board", type: "" }, ["text/*"])).toBe(false);
  });
});
