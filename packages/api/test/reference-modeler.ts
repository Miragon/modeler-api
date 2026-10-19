/**
 * A minimal CONFORMING modeler over a toy "lines" notation (document = an
 * optional `title: …` line, then lines; canonical = title first, lines sorted,
 * trailing newline). Each line is an element whose id is the line's text,
 * unless the line names another one with a ` #id` suffix — the serializer
 * writes that suffix back whenever an element's id differs from its text (a
 * renamed element keeps its id). It is the kit's reference subject, plus
 * deliberately BROKEN variants: one per real-world drift the contract exists
 * to prevent AND one per case in the kit, so the kit's own CI proves every
 * case bites. Each variant must fail exactly its law's case set. Three
 * variants are NOT flaws but legitimate implementation choices the kit must
 * accept (a diagram-js style enriched view-state readback, commands ignored
 * before the first import, an empty name that reads back absent) — they must
 * fail nothing. Two variants ignore a RECOMMENDATION — they must fail nothing
 * and advise once.
 */
import type { CollaborativeModeler, ElementsSurface, ImportResult, ModelerMeta } from "../src/index.js";
import { MODELER_API_VERSION } from "../src/index.js";

export interface Flaws {
  /** meta.apiVersion of a foreign major */
  incompatibleApiVersion?: boolean;
  /** fire onContentChanged from importText (the wardley importDSL echo) */
  echoImport?: boolean;
  /** fire the import echo ONLY when undo history exists (an engine that emits from clear() when there is something to clear) */
  echoOnHistoryOnly?: boolean;
  /** fire the import echo only for documents carrying foreign content (a migration path that emits) */
  echoOnForeignOnly?: boolean;
  /** export stamps extra content — NOT a fixpoint of its own parser */
  nonCanonicalExport?: boolean;
  /** keep the undo stack across imports; undo RESTORES a snapshot (the tt stale-undo, snapshot form) */
  staleUndo?: boolean;
  /** keep the undo stack across imports; undo REMOVES the created element by id — a diagram-js style
   *  delta revert that is a silent no-op unless the re-imported document contains the id */
  staleUndoDelta?: boolean;
  /** undo on an EMPTY stack still emits onContentChanged */
  undoOnEmptyEmits?: boolean;
  /** ignore unsubscribes */
  leakyUnsubscribe?: boolean;
  /** drop every line the parser does not understand (a stripping schema) */
  dropForeign?: boolean;
  /** a rejected import blanks the canvas and wedges the parser for good */
  wedgeAfterReject?: boolean;
  /** a rejected import erases the undo history before rejecting */
  rejectClearsUndo?: boolean;
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
  /** the enriched readback is NOT accepted by setViewState (only the literal shape is) */
  readbackNotSettable?: boolean;
  /** getViewState throws before the first import */
  viewStateThrowsBeforeImport?: boolean;
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
  /** a second destroy() throws */
  destroyThrowsTwice?: boolean;
  /** the viewer emits change events on import */
  viewerEmits?: boolean;
  /** the viewer's importText throws (no command stack registered) */
  viewerImportThrows?: boolean;
  /** the viewer registers no selection service: reveal returns false for every id */
  viewerCannotReveal?: boolean;
  /** the viewer's import keeps the previous viewport */
  viewerKeepsView?: boolean;
  /** the viewer drops foreign content */
  viewerDropsForeign?: boolean;
  /** the viewer selects but never delivers onSelection */
  viewerDeadSelectionEvents?: boolean;
  /** an element created in the session gets an in-memory id the serializer never writes back — after
   *  export → import it carries the id its text derives */
  idsChangeOnExport?: boolean;
  /** NOT a law violation, a missed recommendation: created elements get ids from a per-instance counter
   *  (`line_1` on every peer) — written back, so they round-trip, but two peers collide */
  counterIds?: boolean;
  /** exportText() or a command before the first import wedges the parser for good */
  wedgeOnPreImportCall?: boolean;
  /** a truncated text (no trailing newline) rejects, but blanks the document first — invisible to the
   *  L7 cases while invalidTexts is [] */
  probeRejectionLeavesTrace?: boolean;
  /** an import commits the open label editor once it has rendered (diagram-js directEditing completing
   *  on the viewbox change) — onto the re-imported element, or onto a removed one */
  commitInteractionOnImport?: boolean;
  /** NOT a law violation, a missed recommendation: an import closes the open label editor and drops
   *  the typed input instead of reopening it on the element with the same id */
  dropInteractionOnImport?: boolean;
  /** NOT a flaw: a command before the first import does nothing — no element, no change event (a
   *  harness mutate that waits for that event never settles) */
  ignoresCommandsBeforeImport?: boolean;
  /** NOT a flaw: an element without a label (a `~` line) reports the name "" when created in the
   *  session and no name at all when read from a text */
  blankNamesReadBackAbsent?: boolean;
}

export interface ReferenceModeler extends CollaborativeModeler {
  /** the "user command" the harness drives element mutations with */
  addLine(text: string): void;
  /** the config edit outside the command stack */
  setTitle(title: string): void;
  /** the modeler's own undo / redo */
  undoCommand(): void;
  redoCommand(): void;
  /** open the label editor on an element and type into it — input nothing has committed yet */
  editLabel(elementId: string, typed: string): void;
  /** the open label editor, if any */
  openLabelEditor(): { elementId: string; text: string } | undefined;
  /** commit the open label editor: renames its element, an undoable command */
  commitLabel(): void;
}

interface View {
  zoom: number;
  scrollX: number;
}

interface Entry {
  readonly id: string;
  readonly text: string;
  /** created by a command in this session, not read from a text */
  readonly created?: boolean;
}

/** a line naming its element's id: `text #id` */
const ID_SUFFIX = /^(.*\S) #(\S+)$/;

export function createReferenceModeler(flaws: Flaws = {}, editable = true): ReferenceModeler {
  let title = "";
  let entries: Entry[] = [];
  let undoStack: Array<{ undo(): void; redo(): void }> = [];
  let redoStack: Array<{ undo(): void; redo(): void }> = [];
  const fittedView: View = { zoom: 1, scrollX: 0 };
  let view: View | undefined; // undefined before the first import
  const listeners = new Set<() => void>();
  let selection: string[] = [];
  const selectionListeners = new Set<(ids: string[]) => void>();
  let wedged = false;
  let mutated = false;
  let destroyed = false;
  let imported = false;
  let createdCount = 0;
  let labelEditor: { elementId: string; text: string } | undefined;
  const keepsHistory = Boolean(flaws.staleUndo || flaws.staleUndoDelta);

  const emit = (): void => {
    for (const cb of listeners) cb();
  };
  const select = (ids: string[]): void => {
    if (JSON.stringify(ids) === JSON.stringify(selection)) return; // engines deduplicate
    selection = ids;
    if (flaws.deadSelection || (!editable && flaws.viewerDeadSelectionEvents)) return;
    for (const cb of selectionListeners) cb(selection);
  };
  const lineOf = (entry: Entry): string =>
    entry.id === entry.text || flaws.idsChangeOnExport ? entry.text : `${entry.text} #${entry.id}`;
  const entryOf = (line: string): Entry => {
    const named = ID_SUFFIX.exec(line);
    return named ? { text: named[1] ?? line, id: named[2] ?? line } : { id: line, text: line };
  };
  const canonical = (): string => {
    const body = entries.map(lineOf).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const out = [...(title ? [`title: ${title}`] : []), ...body];
    return out.length === 0 ? "" : `${out.join("\n")}\n`;
  };
  const nameOf = (entry: Entry | undefined): string | undefined => {
    if (!flaws.blankNamesReadBackAbsent || !entry?.text.startsWith("~")) return entry?.text;
    return entry.created ? "" : undefined;
  };
  const ids = (): string[] =>
    flaws.positionalIds ? entries.map((_e, i) => `l${entries.length - i}`) : entries.map((e) => e.id);
  /** a pre-import call the wedging variant never recovers from */
  const touchBeforeImport = (): void => {
    if (flaws.wedgeOnPreImportCall && !imported) wedged = true;
  };
  const commitLabel = (): void => {
    const edit = labelEditor;
    if (!edit) return;
    labelEditor = undefined;
    // committed onto a removed element, the change still fires — diagram-js
    // updates the detached shape through the command stack
    const before = entries;
    const reported = ids();
    entries = entries.map((e, i) => (reported[i] === edit.elementId ? { id: e.id, text: edit.text } : e));
    const after = entries;
    undoStack.push({
      undo: () => {
        entries = before;
      },
      redo: () => {
        entries = after;
      },
    });
    redoStack = [];
    emit();
  };
  const enriched = (v: View): Record<string, unknown> => ({
    ...v,
    zoom: Math.round(v.zoom * 1000) / 1000,
    scale: v.zoom,
    inner: { width: 100 },
    outer: { width: 800 },
  });

  const meta: ModelerMeta = {
    notation: "lines",
    apiVersion: flaws.incompatibleApiVersion ? "9.9.9" : MODELER_API_VERSION,
    editable,
  };

  const elements: ElementsSurface = {
    list: () => ids().map((id, i) => ({ id, name: nameOf(entries[i]) })),
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
        if (flaws.rejectMutatesDoc) entries = [];
        if (flaws.rejectClearsUndo) undoStack = [];
        if (flaws.wedgeAfterReject) {
          wedged = true;
          entries = [];
        }
        throw new Error("lines notation: '!' lines are not importable");
      }
      // the flawed parser treats a text without its final newline as
      // truncated — and blanks the canvas before it rejects
      if (flaws.probeRejectionLeavesTrace && text !== "" && !text.endsWith("\n")) {
        entries = [];
        throw new Error("lines notation: truncated input");
      }
      const titleLine = raw.find((line) => line.startsWith("title: "));
      title = titleLine ? titleLine.slice("title: ".length) : "";
      const body = raw.filter((line) => !line.startsWith("title: "));
      // foreign content ('%' lines) is preserved as plain lines — unless the
      // stripping flaw drops what it does not understand
      const drops = flaws.dropForeign || (!editable && flaws.viewerDropsForeign);
      entries = (drops ? body.filter((line) => !line.startsWith("%")) : body).map(entryOf);
      if (!keepsHistory) {
        undoStack = [];
        redoStack = [];
      }
      // an import fits the view to the content (L5) — unless a flaw keeps it
      const keeps = flaws.noFitOnImport || (!editable && flaws.viewerKeepsView);
      if (!keeps || view === undefined) view = { ...fittedView };
      imported = true;
      // the flawed import completes the open label editor once it rendered
      if (flaws.commitInteractionOnImport) commitLabel();
      // an import never commits an open label editor (L1): it stays open on
      // the element with the same id — with that element gone there is
      // nothing to reopen it on
      const target = labelEditor?.elementId;
      if (flaws.dropInteractionOnImport || target === undefined || !ids().includes(target)) {
        labelEditor = undefined;
      }
      return { warnings: [] };
    },
    exportText(): string {
      touchBeforeImport();
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
      if (view === undefined) {
        if (flaws.viewStateThrowsBeforeImport) throw new Error("no viewbox yet");
        return undefined;
      }
      // the diagram-js viewbox shape: the requested box plus derived keys,
      // rounded — a legitimate readback the kit must accept
      return flaws.enrichedViewStateReadback || flaws.readbackNotSettable ? enriched(view) : { ...view };
    },
    setViewState(state) {
      if (flaws.viewStateEmits) emit();
      if (flaws.noopViewState) return;
      if (state !== null && typeof state === "object") {
        // the flawed setter only takes the literal shape, never its own readback
        if (flaws.readbackNotSettable && "scale" in state) return;
        const { zoom, scrollX } = state as Partial<View>;
        view = { zoom: zoom ?? 1, scrollX: scrollX ?? 0 };
      }
    },
    destroy() {
      if (destroyed && flaws.destroyThrowsTwice) throw new Error("already destroyed");
      destroyed = true;
      labelEditor = undefined;
      listeners.clear();
      selectionListeners.clear();
    },

    addLine(text: string): void {
      if (!editable) throw new Error("a viewer accepts no commands");
      touchBeforeImport();
      if (wedged) throw new Error("lines notation: parser wedged");
      if (flaws.ignoresCommandsBeforeImport && !imported) return;
      // the conforming id is the one the text derives on every import; the
      // counter variant writes its id back, the in-memory variant does not
      createdCount += 1;
      const id = flaws.counterIds ? `line_${createdCount}` : flaws.idsChangeOnExport ? `tmp_${text}` : text;
      // snapshot-based undo, like real command stacks: undoing RESTORES the
      // pre-command document — kept across imports (staleUndo) that means
      // resurrecting the pre-import document, the exact tt drift. The delta
      // variant removes the created element by ID instead — a no-op on any
      // document that lacks it, a deletion on one that carries it
      const before = entries;
      if (flaws.emitBeforeApply) emit();
      entries = [...entries, { id, text, created: true }];
      const after = entries;
      mutated = true;
      undoStack.push(
        flaws.staleUndoDelta
          ? {
              undo: () => {
                entries = entries.filter((e) => e.id !== id);
              },
              redo: () => {
                entries = [...entries, { id, text }];
              },
            }
          : {
              undo: () => {
                entries = before;
              },
              redo: () => {
                entries = after;
              },
            },
      );
      redoStack = [];
      select([ids()[entries.length - 1] ?? id]);
      if (!flaws.emitBeforeApply && !flaws.silentMutation) emit();
    },
    setTitle(next: string): void {
      title = next;
      if (!flaws.configEditSilent) emit();
    },
    undoCommand(): void {
      const step = undoStack.pop();
      if (!step) {
        if (flaws.undoOnEmptyEmits) emit();
        return;
      }
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
    editLabel(elementId: string, typed: string): void {
      if (!editable) throw new Error("a viewer accepts no commands");
      labelEditor = { elementId, text: typed };
    },
    openLabelEditor: () => (labelEditor ? { ...labelEditor } : undefined),
    commitLabel,
  };
  return modeler;
}
