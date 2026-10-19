import { findNodeAtLocation, parseTree, printParseErrorCode, type Node } from "jsonc-parser";
import {
  parseDocumentText,
  validateDocument,
  type SemanticFinding,
} from "@miragon/context-maps-schema-model";

/** A problem of a map text, at character offsets of that text. */
export interface MapProblem {
  severity: "error" | "warning";
  message: string;
  /** The rule of a semantic finding (guide: the code next to the message). */
  rule?: string;
  start: number;
  end: number;
}

/** "CloseBraceExpected" → "close brace expected". */
function words(code: string): string {
  return code.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

function span(node: Node | undefined, text: string): { start: number; end: number } {
  if (!node) return { start: 0, end: Math.max(0, text.indexOf("\n")) || text.length };
  const target = node.parent?.type === "property" ? node.parent : node;
  return { start: target.offset, end: target.offset + target.length };
}

/** The objects of a top-level array (`contexts`, `relationships`) by their `id`. */
function objectsById(tree: Node, array: "contexts" | "relationships"): Array<[string, Node]> {
  const list = findNodeAtLocation(tree, [array]);
  return (list?.children ?? []).flatMap((child): Array<[string, Node]> => {
    const id = findNodeAtLocation(child, ["id"])?.value;
    return typeof id === "string" ? [[id, child]] : [];
  });
}

function semanticProblems(
  tree: Node,
  text: string,
  findings: SemanticFinding[],
  severity: MapProblem["severity"],
): MapProblem[] {
  const relationships = objectsById(tree, "relationships");
  const contexts = objectsById(tree, "contexts");
  const problems: MapProblem[] = [];
  for (const finding of findings) {
    let node: Node | undefined;
    if (finding.relationshipId !== undefined) {
      const matches = relationships.filter(([id]) => id === finding.relationshipId);
      // A duplicate is reported on the copy, not on the element it repeats.
      node = (finding.rule === "unique-ids" ? matches.at(-1) : matches[0])?.[1];
    } else if (finding.rule === "unique-ids") {
      const id = /"(.*)"/.exec(finding.message)?.[1];
      node = contexts.filter(([candidate]) => candidate === id).at(-1)?.[1];
    }
    problems.push({ severity, message: finding.message, rule: finding.rule, ...span(node, text) });
  }
  return problems;
}

/**
 * Every problem of a map text: JSON syntax errors, structural errors at the offending value, and
 * the semantic rules (relationship findings on the relationship's object). An empty text is an
 * empty map, without problems.
 */
export function mapProblems(text: string): MapProblem[] {
  if (text.trim() === "") return [];
  const syntaxErrors: Array<{ error: number; offset: number; length: number }> = [];
  const tree = parseTree(text, syntaxErrors, { disallowComments: true, allowTrailingComma: false });
  if (syntaxErrors.length > 0 || !tree) {
    return syntaxErrors.map((error) => ({
      severity: "error",
      message: `Not valid JSON: ${words(printParseErrorCode(error.error))}.`,
      start: error.offset,
      end: error.offset + Math.max(error.length, 1),
    }));
  }
  const parsed = parseDocumentText(text);
  if (!parsed.ok) {
    return (parsed.issues ?? [{ path: [], message: parsed.error }]).map((issue) => {
      const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return {
        severity: "error",
        message: `${where}${issue.message}`,
        ...span(
          issue.path.length > 0 ? findNodeAtLocation(tree, [...issue.path]) : undefined,
          text,
        ),
      };
    });
  }
  const report = validateDocument(parsed.document);
  return [
    ...semanticProblems(tree, text, report.errors, "error"),
    ...semanticProblems(tree, text, report.warnings, "warning"),
  ];
}

/** The problems pill's summary: how many problems, how many of them errors. */
export function problemCounts(problems: readonly MapProblem[]): { count: number; errors: number } {
  return {
    count: problems.length,
    errors: problems.filter((problem) => problem.severity === "error").length,
  };
}
