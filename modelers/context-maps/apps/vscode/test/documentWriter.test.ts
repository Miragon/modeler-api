import { beforeEach, describe, expect, it } from "vitest";
import { DocumentWriter } from "../src/documentWriter.js";
import { vscodeMock } from "./__mocks__/vscode.js";

beforeEach(() => vscodeMock.reset());

describe("DocumentWriter", () => {
  it("writes one minimal line edit per text and recognizes its echo once", async () => {
    const document = vscodeMock.openDocument("/map.cm", '{\n  "title": "a"\n}\n');
    const writer = new DocumentWriter(document as never);
    await writer.write(() => '{\n  "title": "b"\n}\n', { suppressEcho: true });
    const [edit] = vscodeMock.appliedEdits();
    expect(edit!.edits).toHaveLength(1);
    expect(edit!.edits[0]!.text).toBe('  "title": "b"\n');
    expect(document.getText()).toBe('{\n  "title": "b"\n}\n');
    expect(writer.consumeEcho()).toBe(true);
    expect(writer.consumeEcho()).toBe(false);
  });

  it("matches echoes regardless of the document's line breaks", async () => {
    const document = vscodeMock.openDocument("/map.cm", '{\r\n  "title": "a"\r\n}\r\n');
    const writer = new DocumentWriter(document as never);
    await writer.write(() => '{\n  "title": "b"\n}\n', { suppressEcho: true });
    expect(document.getText()).toBe('{\r\n  "title": "b"\r\n}\r\n');
    expect(writer.consumeEcho()).toBe(true);
  });

  it("writes nothing for an unchanged text and keeps no echo for a visible write", async () => {
    const document = vscodeMock.openDocument("/map.cm", "{}\n");
    const writer = new DocumentWriter(document as never);
    await writer.write(() => "{}\n", { suppressEcho: true });
    expect(vscodeMock.appliedEdits()).toHaveLength(0);
    await writer.write(() => "{ }\n", { suppressEcho: false });
    expect(writer.consumeEcho()).toBe(false);
  });
});
