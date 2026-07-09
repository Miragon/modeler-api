/** Import/export of Context Mapper CML (`.cml`) for strategic-DDD interop. */

import { parseCml, serializeCml } from "@miragon/context-maps-cml";
import { parseDocument } from "@miragon/context-maps-schema-model";
import type { CmDocument } from "@miragon/context-maps-schema-model";
import { downloadBlob, slugify } from "./download";

export const CML_EXTENSION = ".cml";

export function exportCml(doc: CmDocument): void {
  const cml = serializeCml(doc);
  const blob = new Blob([cml], { type: "text/plain;charset=utf-8" });
  downloadBlob(`${slugify(doc.title)}${CML_EXTENSION}`, blob);
}

/** Non-fatal notes (`diagnostics`) carry skipped tactical constructs, etc. */
export type CmlImportResult =
  | { ok: true; document: CmDocument; diagnostics: string[] }
  | { ok: false; error: string; diagnostics?: string[] };

export async function importCmlFile(file: File): Promise<CmlImportResult> {
  try {
    const text = await file.text();
    const { document, diagnostics } = parseCml(text);
    const parsed = parseDocument(document);
    const notes = diagnostics.map((d) => d.message);
    return parsed.ok
      ? { ok: true, document: parsed.document, diagnostics: notes }
      : { ok: false, error: parsed.error, diagnostics: notes };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not read CML file",
    };
  }
}
