/** Import and export of Context Mapper CML (`.cml`) for strategic-DDD interop. */

import { parseCml, serializeCml } from "@miragon/context-maps-cml";
import { parseDocument } from "@miragon/context-maps-schema-model";
import type { CmDocument } from "@miragon/context-maps-schema-model";
import { downloadText } from "./download";

export const CML_EXTENSION = ".cml";

export function exportCml(doc: CmDocument, fileName: string): void {
  downloadText(fileName, serializeCml(doc), "text/plain;charset=utf-8");
}

/** A CML file read as a map, with the statements the reader skipped. */
export interface CmlImport {
  readonly document: CmDocument;
  readonly skipped: readonly string[];
}

/**
 * Reads a `.cml` file as a map. Throws when it holds no context map the reader can use; the
 * statements it could not take (tactical constructs, unknown roles) come back as `skipped`.
 */
export async function readCmlFile(file: File): Promise<CmlImport> {
  const { document, diagnostics } = parseCml(await file.text());
  const failure = diagnostics.find((diagnostic) => diagnostic.severity === "error");
  if (failure) throw new Error(failure.message);
  const parsed = parseDocument(document);
  if (!parsed.ok) throw new Error(parsed.error);
  return {
    document: parsed.document,
    skipped: diagnostics.map((diagnostic) => diagnostic.message),
  };
}
