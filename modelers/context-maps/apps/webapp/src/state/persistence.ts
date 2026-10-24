/**
 * The browser's copy of the working map and of the view preferences, so a reload never loses
 * work. Offline, no network involved. A blocked storage (private mode, a policy) saves nothing and
 * restores nothing; the page keeps working.
 */

import { parseDocument, serializeDocument } from "@miragon/context-maps-schema-model";
import type { CmDocument } from "@miragon/context-maps-schema-model";

const DOCUMENT_KEY = "cm-modeler:document:v1";
const LEGEND_OPEN_KEY = "cm-modeler:legend-open";

export type SaveOutcome = "saved" | "full" | "unavailable";

function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      error.code === 22)
  );
}

export function saveToStorage(doc: CmDocument): SaveOutcome {
  const store = storage();
  if (!store) return "unavailable";
  try {
    store.setItem(DOCUMENT_KEY, serializeDocument(doc, false));
    return "saved";
  } catch (error) {
    return isQuotaError(error) ? "full" : "unavailable";
  }
}

export function loadFromStorage(): CmDocument | null {
  try {
    const raw = storage()?.getItem(DOCUMENT_KEY);
    if (!raw) return null;
    const parsed = parseDocument(JSON.parse(raw));
    if (!parsed.ok) {
      console.warn("[cm-modeler] Ignoring a corrupted autosave:", parsed.error);
      return null;
    }
    return parsed.document;
  } catch (error) {
    console.warn("[cm-modeler] Could not read the autosave:", error);
    return null;
  }
}

/** Whether the browser holds a copy of a map at all, readable or not. */
export function hasStoredDocument(): boolean {
  try {
    return Boolean(storage()?.getItem(DOCUMENT_KEY));
  } catch {
    return false;
  }
}

/** Whether the legend was open when this browser last showed it; undefined before the first toggle. */
export function readLegendOpen(): boolean | undefined {
  try {
    const stored = storage()?.getItem(LEGEND_OPEN_KEY);
    return stored === null || stored === undefined ? undefined : stored === "1";
  } catch {
    return undefined;
  }
}

export function writeLegendOpen(open: boolean): void {
  try {
    storage()?.setItem(LEGEND_OPEN_KEY, open ? "1" : "0");
  } catch {
    // The choice still holds for this page.
  }
}
