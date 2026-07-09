/**
 * Autosave + restore of the working document to localStorage, so a refresh
 * never loses work. Offline-friendly; no network involved.
 */

import { serializeDocument } from "@miragon/context-maps-schema-model";
import { parseDocument } from "@miragon/context-maps-schema-model";
import type { CmDocument } from "@miragon/context-maps-schema-model";
import { toast } from "@/ui/toast";

const STORAGE_KEY = "cm-modeler:document:v1";

/** Only warn about a full quota once per session to avoid toast spam. */
let quotaWarned = false;

function hasStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function isQuotaError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === "QuotaExceededError" ||
      err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      err.code === 22)
  );
}

export function saveToStorage(doc: CmDocument): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeDocument(doc, false));
  } catch (err) {
    // Autosave is best-effort, but a full quota means silent data loss —
    // surface it once so the user can export their diagram instead.
    if (isQuotaError(err) && !quotaWarned) {
      quotaWarned = true;
      toast(
        "Autosave paused — browser storage is full. Use Export (JSON) to keep your diagram safe.",
        "error",
      );
    }
  }
}

export function loadFromStorage(): CmDocument | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = parseDocument(JSON.parse(raw));
    if (!parsed.ok) {
      console.warn("[cm-modeler] Ignoring corrupted autosave:", parsed.error);
      return null;
    }
    return parsed.document;
  } catch (err) {
    console.warn("[cm-modeler] Could not read autosave:", err);
    return null;
  }
}

export function clearStorage(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
