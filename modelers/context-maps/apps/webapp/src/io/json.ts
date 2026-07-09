/** Import/export of the native, deterministic `.cm.json` document format. */

import { serializeDocument } from "@miragon/context-maps-schema-model";
import { parseDocument, type ParseResult } from "@miragon/context-maps-schema-model";
import type { CmDocument } from "@miragon/context-maps-schema-model";
import { downloadBlob, slugify } from "./download";

export const JSON_EXTENSION = ".cm.json";

export function exportJson(doc: CmDocument): void {
  const json = serializeDocument(doc, true);
  const blob = new Blob([json], { type: "application/json" });
  downloadBlob(`${slugify(doc.title)}${JSON_EXTENSION}`, blob);
}

export async function importJsonFile(file: File): Promise<ParseResult> {
  try {
    const text = await file.text();
    return parseDocument(JSON.parse(text));
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not read file",
    };
  }
}
