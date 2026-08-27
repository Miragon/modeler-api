/**
 * @miragon/modeler-api — ONE interface every Miragon modeler implements.
 *
 * The contract encodes, as REQUIREMENTS, the behavioral drift that had to be
 * discovered per modeler against engine internals before it existed:
 * an `importDSL` that emitted change events (rewriting hand-authored files on
 * open), an import that left the undo stack on stale removed shapes, a
 * serializer that was not a byte fixpoint. A host embedding a conforming
 * modeler needs no per-engine suppression tricks — the laws below hold.
 *
 * The conformance test kit (`@miragon/modeler-api/conformance`) turns each
 * law into an executable case the modeler repo runs in its own CI.
 */

/** the semver of THIS contract — a modeler declares the version it implements
 *  in `meta.apiVersion`; hosts match on the major. The constant follows the
 *  PACKAGE version (one identity; a test pins the majors together): modelers
 *  pin the npm package, the constant is what travels in `meta`. */
export const MODELER_API_VERSION = "0.1.0";

export interface ModelerMeta {
  /** stable notation id, e.g. "wardley", "team-topology", "event-storming" */
  readonly notation: string;
  /** the MODELER_API_VERSION this modeler implements (same major = compatible) */
  readonly apiVersion: string;
}

export interface ImportResult {
  /** non-fatal notes from the import (unknown lines kept, migrations run) */
  warnings: string[];
}

export interface ElementInfo {
  /** stable element id — identical across re-imports of the same text */
  id: string;
  /** human label, when the notation has one */
  name?: string;
}

/**
 * Optional element surface — what a host needs for presence outlines,
 * anchored todos and `?element=` deep links. Absent = the notation has no
 * addressable element identity.
 */
export interface ElementsSurface {
  /** every addressable element currently on the canvas */
  list(): ElementInfo[];
  /** select + scroll the element into view; false when the id is unknown */
  reveal(id: string): boolean;
  /** selection changes as STABLE ids; returns the unsubscribe */
  onSelection(cb: (ids: string[]) => void): () => void;
}

/**
 * The collaborative-modeler contract. The LAWS (verified by the conformance
 * kit) are part of the interface:
 *
 *  L1 SILENT IMPORT — `importText` never fires `onContentChanged` and erases
 *     the undo history without emitting. Hosts re-import remote states on
 *     every sync; an import echo would re-export the canonical serialization
 *     over half-typed peer text.
 *  L2 CANONICAL FIXPOINT — `exportText` is deterministic, and for any text t:
 *     with c = exportText() after importText(t), importText(c) followed by
 *     exportText() returns c byte-for-byte. Canonicalization is idempotent;
 *     opening a file never rewrites it.
 *  L3 ONE CHANGE EVENT — every user-visible atomic change (element edits AND
 *     config/axis edits) fires `onContentChanged` at least once, and nothing
 *     else does: not `importText`, not undo-history housekeeping. Undo/redo
 *     themselves ARE user-visible changes and fire.
 *  L4 DEFINED UNDO ACROSS IMPORTS — undo directly after an `importText` is a
 *     no-op: it must never mutate or resurrect shapes from the pre-import
 *     document (id coincidence included).
 *  L5 VIEW-STATE ROUND-TRIP — `getViewState`/`setViewState` survive a
 *     re-import: snapshot before, restore after, viewport unchanged.
 *  L6 EXPORT IS TOTAL AFTER IMPORT — after a successful import (and any
 *     sequence of user commands), `exportText` succeeds. Foreign or
 *     auxiliary content the modeler does not understand is preserved, never
 *     a reason to throw.
 *  L7 REJECTED IMPORTS LEAVE NO TRACE — `importText` on non-importable text
 *     REJECTS (resolve-with-warnings means "imported, with notes"; rejection
 *     means "nothing imported"): afterwards the previously imported document
 *     is still rendered, `exportText` still returns it, no change event has
 *     fired and the undo history is as an import leaves it. Hosts re-import
 *     half-typed peer text on every sync — "blank canvas until healed" is
 *     not an acceptable failure mode.
 *
 *  View state is NEVER part of the document: `setViewState` fires no change
 *  events and `exportText` is independent of it.
 */
export interface CollaborativeModeler {
  readonly meta: ModelerMeta;

  /** mount the canvas into a host element (once, before the first import) */
  attachTo(host: Element): void;

  /** parse + render `text` — SILENT per L1; resolves when rendered */
  importText(text: string): Promise<ImportResult>;

  /** the canonical serialization of the current document (L2, L6) */
  exportText(): string;

  /** subscribe to user-visible model changes (L3); returns the unsubscribe */
  onContentChanged(cb: () => void): () => void;

  /** opaque viewport snapshot (zoom/scroll) — JSON-serializable (L5) */
  getViewState(): unknown;
  setViewState(state: unknown): void;

  readonly elements?: ElementsSurface;

  /** tear down DOM + listeners; further calls on the instance are undefined
   *  behavior, but a second destroy() must not throw */
  destroy(): void;
}
