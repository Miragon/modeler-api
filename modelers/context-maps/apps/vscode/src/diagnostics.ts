import * as vscode from "vscode";
import type { MapProblem } from "./problems.js";

export const DIAGNOSTIC_COLLECTION_NAME = "context-maps";

/** Line and character of `offset` in `text`, counting "\r\n" and "\n" as one line break. */
function positionAt(text: string, offset: number): vscode.Position {
  let line = 0;
  let lineStart = 0;
  for (let index = 0; index < offset && index < text.length; index += 1) {
    if (text[index] === "\n") {
      line += 1;
      lineStart = index + 1;
    }
  }
  const character = Math.max(0, offset - lineStart - (text[offset - 1] === "\r" ? 1 : 0));
  return new vscode.Position(line, character);
}

/**
 * The problems as diagnostics of the text they were found in. `atStart` puts every one at the
 * start of the file, for a document whose text is not the file's content (an embedded PNG).
 */
export function toDiagnostics(
  text: string,
  problems: readonly MapProblem[],
  atStart = false,
): vscode.Diagnostic[] {
  return problems.map((problem) => {
    const range = atStart
      ? new vscode.Range(0, 0, 0, 0)
      : new vscode.Range(positionAt(text, problem.start), positionAt(text, problem.end));
    const diagnostic = new vscode.Diagnostic(
      range,
      problem.message,
      problem.severity === "error"
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning,
    );
    diagnostic.source = DIAGNOSTIC_COLLECTION_NAME;
    if (problem.rule) diagnostic.code = problem.rule;
    return diagnostic;
  });
}
