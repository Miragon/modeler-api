import {
  MODELER_API_VERSION,
  type CollaborativeModeler,
  type ElementInfo,
  type ElementsSurface,
  type ImportResult,
  type ModelerMeta,
} from "@miragon/modeler-api";
import type { ModuleDeclaration } from "didi";
import type Canvas from "diagram-js/lib/core/Canvas";
import type ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import type EventBus from "diagram-js/lib/core/EventBus";
import type Selection from "diagram-js/lib/features/selection/Selection";
import type { Element } from "diagram-js/lib/model/Types";
import type { CmViewerOptions, FreeRectInsets } from "../CmBaseViewer.js";
import { Modeler } from "../Modeler.js";
import { NavigatedViewer } from "../NavigatedViewer.js";
import { isCmElement, type CmElement } from "../model/di-types.js";

/** Stable notation id in `meta.notation` of the collaborative-modeler contract. */
export const CONTEXT_MAPS_NOTATION = "context-maps";

export interface CollaborativeContextMapsOptions {
  /** Appended to the renderer's own modules (e.g. a host's chrome module). */
  additionalModules?: ModuleDeclaration[] | undefined;
  /** See `CmViewerOptions.undoRedoKeys` (default true). */
  undoRedoKeys?: boolean | undefined;
  /** See `CmViewerOptions.freeRectInsets`. */
  freeRectInsets?: (() => FreeRectInsets) | undefined;
}

/** The contract surface plus the wrapped diagram for host-specific wiring. */
export interface CollaborativeContextMapsModeler extends CollaborativeModeler {
  readonly elements: ElementsSurface;
  readonly diagram: Modeler | NavigatedViewer;
}

interface ViewState {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The editing mount (`meta.editable: true`) of the collaborative-modeler contract: the text lane
 * is the canonical JSON of a `.cm`/`.cm.json` file (`serializeDocumentText`).
 */
export function createCollaborativeModeler(
  options: CollaborativeContextMapsOptions = {},
): CollaborativeContextMapsModeler {
  return collaborative(
    new Modeler({
      ...diagramOptions(options),
      undoRedoKeys: options.undoRedoKeys ?? true,
      freeRectInsets: options.freeRectInsets,
    }),
    true,
  );
}

/** The read-only mount (`meta.editable: false`): imports, exports and reveals, never edits. */
export function createCollaborativeViewer(
  options: Omit<CollaborativeContextMapsOptions, "undoRedoKeys"> = {},
): CollaborativeContextMapsModeler {
  return collaborative(
    new NavigatedViewer({
      ...diagramOptions(options),
      freeRectInsets: options.freeRectInsets,
    }),
    false,
  );
}

function diagramOptions(
  options: Pick<CollaborativeContextMapsOptions, "additionalModules">,
): CmViewerOptions {
  return { width: "100%", height: "100%", additionalModules: options.additionalModules ?? [] };
}

function collaborative(
  diagram: Modeler | NavigatedViewer,
  editable: boolean,
): CollaborativeContextMapsModeler {
  const eventBus = diagram.get<EventBus>("eventBus");
  const canvas = diagram.get<Canvas>("canvas");
  const elementRegistry = diagram.get<ElementRegistry>("elementRegistry");
  const selection = diagram.get<Selection>("selection");
  const contentListeners = new Set<() => void>();
  let destroyed = false;
  let lastExport = "";

  const meta: ModelerMeta = {
    notation: CONTEXT_MAPS_NOTATION,
    apiVersion: MODELER_API_VERSION,
    editable,
  };

  // An import never touches the command stack (it erases the history without an event), so every
  // `commandStack.changed` is a user-visible change: element commands, the title, undo and redo.
  if (editable) {
    eventBus.on("commandStack.changed", () => {
      for (const listener of [...contentListeners]) listener();
    });
  }

  const elements: ElementsSurface = {
    list: () =>
      destroyed ? [] : (elementRegistry.getAll() as unknown[]).filter(isCmElement).map(elementInfo),
    reveal(id) {
      if (destroyed) return false;
      const element = elementRegistry.get(id);
      if (!isCmElement(element)) return false;
      selection.select(element as Element);
      canvas.scrollToElement(element as Element);
      return true;
    },
    selection: () => (destroyed ? [] : elementIds(selection.get())),
    onSelection(callback) {
      const listener = (event: unknown) =>
        callback(elementIds((event as { newSelection?: unknown[] }).newSelection ?? []));
      eventBus.on("selection.changed", listener);
      return () => eventBus.off("selection.changed", listener);
    },
  };

  return {
    meta,
    elements,
    diagram,
    attachTo(host) {
      diagram.attachTo(host as HTMLElement);
    },
    async importText(text): Promise<ImportResult> {
      if (destroyed) throw new Error("The modeler was destroyed.");
      const { warnings } = diagram.importText(text);
      return { warnings: warnings.map((warning) => warning.message) };
    },
    exportText() {
      // Asking a destroyed diagram would build a new one on the detached container.
      if (destroyed) return lastExport;
      return diagram.exportText();
    },
    onContentChanged(callback) {
      if (!editable) return () => undefined;
      contentListeners.add(callback);
      return () => contentListeners.delete(callback);
    },
    getViewState(): ViewState | undefined {
      if (destroyed) return undefined;
      try {
        const { x, y, width, height } = canvas.viewbox();
        const state = { x, y, width, height };
        return isViewState(state) ? state : undefined;
      } catch {
        return undefined;
      }
    },
    setViewState(state) {
      if (destroyed || !isViewState(state)) return;
      canvas.viewbox({ x: state.x, y: state.y, width: state.width, height: state.height });
    },
    destroy() {
      if (destroyed) return;
      try {
        lastExport = diagram.exportText();
      } catch {
        lastExport = "";
      }
      destroyed = true;
      contentListeners.clear();
      diagram.destroy();
    },
  };
}

function elementIds(elements: readonly unknown[]): string[] {
  return elements.filter(isCmElement).map((element) => element.id);
}

function elementInfo(element: CmElement): ElementInfo {
  return element.cmLabel ? { id: element.id, name: element.cmLabel } : { id: element.id };
}

function isViewState(state: unknown): state is ViewState {
  if (typeof state !== "object" || state === null) return false;
  const { x, y, width, height } = state as Record<string, unknown>;
  return (
    isFiniteNumber(x) &&
    isFiniteNumber(y) &&
    isFiniteNumber(width) &&
    isFiniteNumber(height) &&
    width > 0 &&
    height > 0
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
