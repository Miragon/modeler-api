import type { ProblemItem, ProblemSeverity } from "@miragon/modeler-shell";
import {
  isSymmetricPattern,
  validateDocument,
  type CmDocument,
  type SemanticFinding,
} from "@miragon/context-maps-schema-model";

/** "“Ordering” → “Billing”": the ends of a relationship; a symmetric pattern has no direction. */
function relationshipPlace(doc: CmDocument, relationshipId: string): string | undefined {
  const relationship = doc.relationships.find((candidate) => candidate.id === relationshipId);
  if (!relationship) return undefined;
  const label = (id: string) => doc.contexts.find((context) => context.id === id)?.label ?? id;
  const arrow = isSymmetricPattern(relationship.pattern) ? "↔" : "→";
  return `“${label(relationship.from)}” ${arrow} “${label(relationship.to)}”`;
}

/**
 * The map's semantic findings as rows of the problems list (guide §5.10): errors first, each with
 * the relationship it concerns as its place, and that relationship to select where the canvas
 * draws it.
 */
export function mapProblems(doc: CmDocument, isDrawn: (id: string) => boolean): ProblemItem[] {
  const report = validateDocument(doc);
  const item =
    (severity: ProblemSeverity) =>
    (finding: SemanticFinding): ProblemItem => {
      const id = finding.relationshipId;
      const location = id === undefined ? undefined : relationshipPlace(doc, id);
      return {
        severity,
        message: finding.message,
        ...(location ? { location } : {}),
        ...(id !== undefined && isDrawn(id) ? { elementId: id } : {}),
      };
    };
  return [...report.errors.map(item("error")), ...report.warnings.map(item("warning"))];
}

/** What an import could not take, located in the file it came from. */
export function importNotes(fileName: string, messages: readonly string[]): ProblemItem[] {
  return messages.map((message) => ({ severity: "warning", message, location: fileName }));
}

/** The toast after an import with notes points at the pill (guide §9). */
export function importNotesText(count: number, pillLabel: string): string {
  const warnings = count === 1 ? "1 warning" : `${count} warnings`;
  return `Imported with ${warnings}. Details under “${pillLabel}” bottom left.`;
}
