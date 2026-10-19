/** The map's own file: the canonical `.cm.json` text, deterministic and lossless. */

import { parseDocumentText, serializeDocumentText } from "@miragon/context-maps-schema-model";
import type { CmDocument } from "@miragon/context-maps-schema-model";
import { downloadText } from "./download";

export const JSON_EXTENSION = ".cm.json";

export function exportJson(doc: CmDocument, fileName: string): void {
  downloadText(fileName, serializeDocumentText(doc), "application/json");
}

/** Reads a `.cm`, `.cm.json` or `.json` file as a map; throws with the reason when it is none. */
export async function readMapFile(file: File): Promise<CmDocument> {
  const parsed = parseDocumentText(await file.text());
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.document;
}
