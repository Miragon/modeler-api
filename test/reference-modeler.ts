/**
 * A minimal CONFORMING modeler over a toy "lines" notation (document = an
 * optional `title: …` line, then lines; canonical = title first, lines sorted,
 * trailing newline) — the kit's reference subject, plus deliberately BROKEN
 * variants: one per real-world drift the contract exists to prevent AND one
 * per case in the kit, so the kit's own CI proves every case bites. Each
 * variant must fail exactly its law's case set. One variant is NOT a flaw but
 * a legitimate implementation choice the kit must accept (a diagram-js style
 * enriched view-state readback) — it must fail nothing.
 */
import type { CollaborativeModeler, ElementsSurface, ImportResult, ModelerMeta } from "../src/index.js";
import { MODELER_API_VERSION } from "../src/index.js";

export interface Flaws {
  /** fire onContentChanged from importText (the wardley importDSL echo) */
  echoImport?: boolean;
  /** fire the import echo ONLY when undo history exists (an engine that emits from clear() when there is something to clear) */
  echoOnHistoryOnly?: boolean;
  /** fire the import echo only for documents carrying foreign content (a migration path that emits) */
  echoOnForeignOnly?: boolean;
  /** export stamps extra content — NOT a fixpoint of its own parser */
  nonCanonicalExport?: boolean;
  /** keep the undo stack across imports (the tt stale-undo) */
  staleUndo?: boolean;
  /** ignore unsubscribes */
  leakyUnsubscribe?: boolean;
  /** drop every line the parser does not understand (a stripping schema) */
  dropForeign?: boolean;
  /** a rejected import blanks the canvas and wedges the parser for good */
  wedgeAfterReject?: boolean;
  /** undo restores the document but never emits */
  silentUndo?: boolean;
  /** redo restores the document but never emits */
  silentRedo?: boolean;
  /** setViewState is ignored (a modeler without view-state support) */
  noopViewState?: boolean;
  /** an import keeps the previous viewport instead of fitting the content */
  noFitOnImport?: boolean;
  /** NOT a flaw: getViewState returns the state enriched with derived keys (scale, inner, outer — the diagram-js viewbox shape) */
  enrichedViewStateReadback?: boolean;
  /** reveal/commands never deliver a selection */
  deadSelection?: boolean;
  /** onSelection unsubscribes are ignored */
  leakySelectionUnsubscribe?: boolean;
  /** the title edit changes the export but never emits (a config edit outside the command stack) */
  configEditSilent?: boolean;
  /** onContentChanged fires BEFORE the command is applied */
  emitBeforeApply?: boolean;
  /** the element command never emits */
  silentMutation?: boolean;
  /** setViewState emits a change event */
  viewStateEmits?: boolean;
  /** an invalid input resolves (importing nothing) instead of rejecting */
  rejectResolves?: boolean;
  /** an invalid input rejects but clears the document first */
  rejectMutatesDoc?: boolean;
  /** reveal(unknown id) returns true */
  revealUnknownTrue?: boolean;
  /** exportText throws once a command ran */
  exportThrowsAfterMutate?: boolean;
  /** element ids are positional (renumbered from the end on every change) */
  positionalIds?: boolean;
  /** the viewer emits change events on import */
  viewerEmits?: boolean;
  /** the viewer's importText throws (no command stack registered) */
  viewerImportThrows?: boolean;
  /** the viewer registers no selection service: reveal returns false for every id */
  viewerCannotReveal?: boolean;
}

export interface ReferenceModeler extends CollaborativeModeler {
  /** the "user command" the harness drives element mutations with */
  addLine(text: string): void;
  /** the config edit outside the command stack */
  setTitle(title: string): void;
  /** the modeler's own undo / redo */
  undoCommand(): void;
  redoCommand(): void;
}

interface View {
  zoom: number;
  scrollX: number;
}

export function createReferenceModeler(flaws: Flaws = {}, editable = true): ReferenceModeler {
  let title = "";
  let lines: string[] = [];
  let undoStack: Array<{ undo(): void; redo(): void }> = [];
  let redoStack: Array<{ undo(): void; redo(): void }> = [];
  const fittedView: View = { zoom: 1, scrollX: 0 };
  let view: View | undefined; // undefined before the first import
  const listeners = new Set<() => void>();
  let selection: string[] = [];
  const selectionListeners = new Set<(ids: string[]) => void>();
  let wedged = false;
  let mutated = false;

  const emit = (): void => {
    for (const cb of listeners) cb();
  };
  const select = (ids: string[]): void => {
    if (JSON.stringify(ids) === JSON.stringify(selection)) return; // engines deduplicate
    selection = ids;
    if (flaws.deadSelection) return;
    for (const cb of selectionListeners) cb(selection);
  };
  const canonical = (): string => {
    const body = [...lines].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const out = [...(title ? [`title: ${title}`] : []), ...body];
    return out.length === 0 ? "" : `${out.join("\n")}\n`;
  };
  const ids = (): string[] => (flaws.positionalIds ? lines.map((_l, i) => `l${lines.length - i}`) : lines);

  const meta: ModelerMeta = { notation: "lines", apiVersion: MODELER_API_VERSION, editable };

  const elements: ElementsSurface = {
    list: () => ids().map((id, i) => ({ id, name: lines[i] })),
    reveal: (id) => {
      if (!editable && flaws.viewerCannotReveal) return false;
      const known = ids().includes(id);
      if (known) select([id]);
      return flaws.revealUnknownTrue ? true : known;
    },
    selection: () => [...selection],
    onSelection: (cb) => {
      selectionListeners.add(cb);
      return () => {
        if (!flaws.leakySelectionUnsubscribe) selectionListeners.delete(cb);
      };
    },
  };

  const modeler: ReferenceModeler = {
    meta,
    elements,
    attachTo: () => undefined,
    async importText(text: string): Promise<ImportResult> {
      if (!editable && flaws.viewerImportThrows) throw new Error("No provider for commandStack");
      if (wedged) throw new Error("lines notation: parser wedged");
      const foreign = text.includes("%");
      if (
        flaws.echoImport ||
        (flaws.echoOnHistoryOnly && undoStack.length > 0) ||
        (flaws.echoOnForeignOnly && foreign) ||
        (!editable && flaws.viewerEmits)
      ) {
        emit(); // the drift: engines that emit while importing
      }
      const raw = text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "");
      // the toy notation's invalid form: a "!" line — rejected BEFORE any
      // state changes (L7: a rejected import leaves no trace)
      if (raw.some((line) => line.startsWith("!"))) {
        if (flaws.rejectResolves) return { warnings: ["ignored invalid input"] };
        if (flaws.rejectMutatesDoc) lines = [];
        if (flaws.wedgeAfterReject) {
          wedged = true;
          lines = [];
        }
        throw new Error("lines notation: '!' lines are not importable");
      }
      const titleLine = raw.find((line) => line.startsWith("title: "));
      title = titleLine ? titleLine.slice("title: ".length) : "";
      const body = raw.filter((line) => !line.startsWith("title: "));
      // foreign content ('%' lines) is preserved as plain lines — unless the
      // stripping flaw drops what it does not understand
      lines = flaws.dropForeign ? body.filter((line) => !line.startsWith("%")) : body;
      if (!flaws.staleUndo) {
        undoStack = [];
        redoStack = [];
      }
      // an import fits the view to the content (L5) — unless the flaw keeps it
      if (!flaws.noFitOnImport || view === undefined) view = { ...fittedView };
      return { warnings: [] };
    },
    exportText(): string {
      if (flaws.exportThrowsAfterMutate && mutated) throw new Error("BpmnDiOrdering: cannot serialize");
      // the broken variant stamps a footer line — a serializer that is not a
      // fixpoint of its own parser (every open/export round-trip grows the file)
      return flaws.nonCanonicalExport ? `${canonical()}# exported\n` : canonical();
    },
    onContentChanged(cb) {
      listeners.add(cb);
      return () => {
        if (!flaws.leakyUnsubscribe) listeners.delete(cb);
      };
    },
    getViewState: () => {
      if (view === undefined) return undefined;
      // the diagram-js viewbox shape: the requested box plus derived keys,
      // rounded — a legitimate readback the kit must accept
      return flaws.enrichedViewStateReadback
        ? {
            ...view,
            zoom: Math.round(view.zoom * 1000) / 1000,
            scale: view.zoom,
            inner: { width: 100 },
            outer: { width: 800 },
          }
        : { ...view };
    },
    setViewState(state) {
      if (flaws.viewStateEmits) emit();
      if (flaws.noopViewState) return;
      if (state !== null && typeof state === "object") {
        const { zoom, scrollX } = state as Partial<View>;
        view = { zoom: zoom ?? 1, scrollX: scrollX ?? 0 };
      }
    },
    destroy() {
      listeners.clear();
      selectionListeners.clear();
    },

    addLine(text: string): void {
      if (!editable) throw new Error("a viewer accepts no commands");
      if (wedged) throw new Error("lines notation: parser wedged");
      // snapshot-based undo, like real command stacks: undoing RESTORES the
      // pre-command document — kept across imports (staleUndo) that means
      // resurrecting the pre-import document, the exact tt drift
      const before = [...lines];
      if (flaws.emitBeforeApply) emit();
      lines.push(text);
      const after = [...lines];
      mutated = true;
      undoStack.push({
        undo: () => {
          lines = before;
        },
        redo: () => {
          lines = after;
        },
      });
      redoStack = [];
      select([ids()[lines.length - 1] ?? text]);
      if (!flaws.emitBeforeApply && !flaws.silentMutation) emit();
    },
    setTitle(next: string): void {
      title = next;
      if (!flaws.configEditSilent) emit();
    },
    undoCommand(): void {
      const step = undoStack.pop();
      if (!step) return;
      step.undo();
      redoStack.push(step);
      if (!flaws.silentUndo) emit();
    },
    redoCommand(): void {
      const step = redoStack.pop();
      if (!step) return;
      step.redo();
      undoStack.push(step);
      if (!flaws.silentRedo) emit();
    },
  };
  return modeler;
}
