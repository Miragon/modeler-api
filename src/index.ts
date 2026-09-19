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
 *  in `meta.apiVersion`; hosts check compatibility with `apiVersionsCompatible`
 *  (same major; while 0.x, the same minor too). The constant IS the
 *  package version: release-please rewrites the literal below on every
 *  release (release-please-config.json `extra-files`), and the kit's own
 *  test pins it to package.json exactly. Modelers pin the npm package; the
 *  constant is what travels in `meta`. */
export const MODELER_API_VERSION = "0.1.0"; // x-release-please-version

export interface ModelerMeta {
  /** stable notation id, e.g. "wardley", "team-topology", "event-storming" */
  readonly notation: string;
  /** the MODELER_API_VERSION this modeler implements — compatible when the
   *  major matches and, while the contract is 0.x, the minor too (pre-1.0
   *  minors may break: bump-minor-pre-major) */
  readonly apiVersion: string;
  /**
   * true on an editing mount (the package's Modeler), false on a VIEWER
   * (its NavigatedViewer/Viewer): a viewer never fires `onContentChanged`,
   * accepts no user commands, and still imports, exports, reveals and
   * reports view state exactly like the editor — hosts mount it on
   * read-only surfaces (an MCP-App widget in read-only mode) without
   * per-package knowledge or a command-stack shim.
   */
  readonly editable: boolean;
}

export interface ImportResult {
  /** non-fatal notes from the import (unknown lines kept, migrations run) */
  warnings: string[];
}

export interface ElementInfo {
  /**
   * stable element id — identical across re-imports of the same text AND
   * untouched by edits to OTHER elements: hosts anchor todos, presence and
   * `?element=` deep links to it, so an id that renumbers when a line is
   * inserted above (positional edge ids) breaks every anchor below it. An
   * element without an id in the text gets one the serializer WRITES BACK.
   */
  id: string;
  /** human label, when the notation has one */
  name?: string;
}

/**
 * Optional element surface — what a host needs for anchored todos, `?element=`
 * deep links and the selection half of live presence. Absent = the notation
 * has no addressable element identity. Ids are ELEMENT ids throughout: a
 * shape that only labels another element (diagram-js external labels) is
 * reported and revealed as its target, never under its own label id.
 */
export interface ElementsSurface {
  /** every addressable element currently on the canvas */
  list(): ElementInfo[];
  /** select + scroll the element into view; false when the id is unknown.
   *  Revealing is view behavior: it delivers a selection, never a change event */
  reveal(id: string): boolean;
  /** the current selection as stable element ids — synchronous, so a host
   *  can read it at the moment of a click (a deep link carrying the
   *  selection) without caching every delivery */
  selection(): string[];
  /** selection changes as STABLE element ids; returns the unsubscribe */
  onSelection(cb: (ids: string[]) => void): () => void;
}

/**
 * The collaborative-modeler contract. The LAWS (verified by the conformance
 * kit) are part of the interface:
 *
 *  L1 SILENT IMPORT — `importText` never fires `onContentChanged` and erases
 *     the undo history without emitting — also when history exists. Hosts
 *     re-import remote states on every sync; an import echo would re-export
 *     the canonical serialization over half-typed peer text.
 *  L2 CANONICAL FIXPOINT — `exportText` is deterministic, and for any text t:
 *     with c = exportText() after importText(t), importText(c) followed by
 *     exportText() returns c byte-for-byte. Canonicalization is idempotent;
 *     opening a file never rewrites it.
 *  L3 ONE CHANGE EVENT — every user-visible atomic change (element commands
 *     AND config/axis/title/style edits that live in the document, AND
 *     undo/redo) fires `onContentChanged` at least once, and nothing else
 *     does: not `importText`, not undo-history housekeeping, not view or
 *     selection changes. When a listener runs, `exportText()` ALREADY
 *     returns the post-change serialization — hosts export inside the
 *     listener; an emit-before-apply would lose the last edit.
 *  L4 DEFINED UNDO ACROSS IMPORTS — undo directly after an `importText` is a
 *     no-op: it must never mutate or resurrect shapes from the pre-import
 *     document (id coincidence included).
 *  L5 VIEW-STATE ROUND-TRIP — `getViewState`/`setViewState` survive a
 *     re-import: snapshot before, restore after, viewport unchanged. An
 *     import leaves the view FITTED to the content (the defined post-import
 *     view, the same for the same document and host — a host that wants to
 *     keep the user's viewport across a remote re-import snapshots before
 *     and restores after); before the first import `getViewState()` returns
 *     `undefined` or a state `setViewState` accepts, and never throws. The
 *     readback may be a NORMALISED form of what was set (a diagram-js
 *     viewbox comes back rounded, with scale/inner/outer) — what must hold
 *     is that setting a readback yields that readback again.
 *  L6 EXPORT IS TOTAL AFTER IMPORT — after a successful import (and any
 *     sequence of user commands and undos), `exportText` succeeds. Foreign or
 *     auxiliary content the modeler does not understand is PRESERVED through
 *     import → export (it comes back in the export, canonicalised like the
 *     rest), never dropped and never a reason to throw.
 *  L7 REJECTED IMPORTS LEAVE NO TRACE — `importText` on non-importable text
 *     REJECTS (resolve-with-warnings means "imported, with notes"; rejection
 *     means "nothing imported"): afterwards the previously imported document
 *     is still rendered with its elements, `exportText` still returns it, no
 *     change event has fired and the undo history is untouched.
 *     The modeler stays USABLE: the next valid import renders, the next user
 *     command applies. Hosts re-import half-typed peer text on every sync —
 *     "blank (or wedged) until healed" is not an acceptable failure mode.
 *
 *  View state is NEVER part of the document: `setViewState` fires no change
 *  events and `exportText` is independent of it.
 */
export interface CollaborativeModeler {
  readonly meta: ModelerMeta;

  /** mount the canvas into a host element (once, before the first import).
   *  The host must be attached to the document with a non-zero size — a
   *  detached or 0×0 element gives diagram-js engines NaN viewboxes */
  attachTo(host: Element): void;

  /** parse + render `text` — SILENT per L1, the view fitted to the content
   *  per L5; resolves when rendered, REJECTS when nothing was imported (L7) */
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
