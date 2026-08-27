/**
 * A minimal CONFORMING modeler over a toy "lines" notation (document = lines,
 * canonical = sorted + trailing newline) — the kit's reference subject, plus
 * deliberately BROKEN variants that reproduce the real-world drift the
 * contract exists to prevent (import echo, non-canonical serializer, stale
 * undo, leaky unsubscribe). Each variant must fail exactly its law's case.
 */
import type { CollaborativeModeler, ElementsSurface, ImportResult, ModelerMeta } from "../src/index.js";
import { MODELER_API_VERSION } from "../src/index.js";

interface Flaws {
  /** fire onContentChanged from importText (the wardley importDSL echo) */
  echoImport?: boolean;
  /** export stamps extra content — NOT a fixpoint of its own parser */
  nonCanonicalExport?: boolean;
  /** keep the undo stack across imports (the tt stale-undo) */
  staleUndo?: boolean;
  /** ignore unsubscribes */
  leakyUnsubscribe?: boolean;
}

export function createReferenceModeler(flaws: Flaws = {}): CollaborativeModeler {
  let lines: string[] = [];
  let undoStack: Array<() => void> = [];
  let view: { zoom: number; scrollX: number } = { zoom: 1, scrollX: 0 };
  const listeners = new Set<() => void>();
  let selection: string[] = [];
  const selectionListeners = new Set<(ids: string[]) => void>();

  const emit = (): void => {
    for (const cb of listeners) cb();
  };
  const canonical = (input: string[]): string =>
    input.length === 0 ? "" : `${[...input].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).join("\n")}\n`;

  const meta: ModelerMeta = { notation: "lines", apiVersion: MODELER_API_VERSION };

  const elements: ElementsSurface = {
    list: () => lines.map((line) => ({ id: line, name: line })),
    reveal: (id) => lines.includes(id),
    onSelection: (cb) => {
      selectionListeners.add(cb);
      return () => selectionListeners.delete(cb);
    },
  };

  const modeler: CollaborativeModeler & { addLine(text: string): void; undoCommand(): void } = {
    meta,
    elements,
    attachTo: () => undefined,
    async importText(text: string): Promise<ImportResult> {
      if (flaws.echoImport) emit(); // the drift: engines that emit while importing
      const next = text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "");
      // the toy notation's invalid form: a "!" line — rejected BEFORE any
      // state changes (L7: a rejected import leaves no trace)
      if (next.some((line) => line.startsWith("!"))) {
        throw new Error("lines notation: '!' lines are not importable");
      }
      lines = next;
      if (!flaws.staleUndo) undoStack = [];
      return { warnings: [] };
    },
    exportText(): string {
      // the broken variant stamps a footer line — a serializer that is not a
      // fixpoint of its own parser (every open/export round-trip grows the file)
      return flaws.nonCanonicalExport ? `${canonical(lines)}# exported\n` : canonical(lines);
    },
    onContentChanged(cb) {
      listeners.add(cb);
      return () => {
        if (!flaws.leakyUnsubscribe) listeners.delete(cb);
      };
    },
    getViewState: () => ({ ...view }),
    setViewState(state) {
      if (state !== null && typeof state === "object") view = { ...(state as typeof view) };
    },
    destroy() {
      listeners.clear();
      selectionListeners.clear();
    },

    /** the "user command" the harness drives mutations with */
    addLine(text: string): void {
      // snapshot-based undo, like real command stacks: undoing RESTORES the
      // pre-command document — kept across imports (staleUndo) that means
      // resurrecting the pre-import document, the exact tt drift
      const before = [...lines];
      lines.push(text);
      undoStack.push(() => {
        lines = before;
      });
      selection = [text];
      for (const cb of selectionListeners) cb(selection);
      emit();
    },
    /** the modeler's own undo */
    undoCommand(): void {
      const step = undoStack.pop();
      if (!step) return;
      step();
      emit();
    },
  };
  return modeler;
}
