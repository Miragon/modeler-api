import { describe, expect, it } from "vitest";
import { toDiagnostics } from "../src/diagnostics.js";
import { DiagnosticSeverity } from "./__mocks__/vscode.js";

describe("toDiagnostics", () => {
  it("turns offsets into line positions, also across CRLF line breaks", () => {
    const text = '{\r\n  "a": 1,\r\n  "b": 2\r\n}';
    const start = text.indexOf('"b"');
    const [diagnostic] = toDiagnostics(text, [
      { severity: "warning", message: "m", rule: "r", start, end: start + 6 },
    ]);
    expect(diagnostic!.range.start).toEqual({ line: 2, character: 2 });
    expect(diagnostic!.range.end).toEqual({ line: 2, character: 8 });
    expect(diagnostic!.severity).toBe(DiagnosticSeverity.Warning);
    expect(diagnostic!.source).toBe("context-maps");
    expect(diagnostic!.code).toBe("r");
  });

  it("puts every diagnostic at the start of a file whose bytes are not the text", () => {
    const [diagnostic] = toDiagnostics(
      "{\n}",
      [{ severity: "error", message: "m", start: 2, end: 3 }],
      true,
    );
    expect(diagnostic!.range.start).toEqual({ line: 0, character: 0 });
    expect(diagnostic!.severity).toBe(DiagnosticSeverity.Error);
  });
});
