/**
 * Bridges the canonical `CmDocument` into the diagram-js canvas. Contexts become
 * shapes; relationships become connections whose waypoints are cropped to the
 * context box borders. Connections are added first so they sit behind the boxes.
 */

import type Canvas from "diagram-js/lib/core/Canvas";
import type ElementFactory from "diagram-js/lib/core/ElementFactory";
import type ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import type EventBus from "diagram-js/lib/core/EventBus";
import type { Root } from "diagram-js/lib/model/Types";
import type { Point } from "diagram-js/lib/util/Types";
import type { CmDocument } from "@miragon/context-maps-schema-model";
import type CmElementFactory from "../model/CmElementFactory.js";
import type { CmContext } from "../model/di-types.js";
import { ROOT_ID, type ImportWarning, type RootBusinessObject } from "./types.js";

type RootWithMeta = Root & { businessObject?: RootBusinessObject };

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The point where the ray from a rect's centre toward `toward` crosses its border. */
function borderPoint(rect: Rect, toward: Point): Point {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const sx = dx !== 0 ? rect.width / 2 / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? rect.height / 2 / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

function centre(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

export default class CmImporter {
  static $inject = ["canvas", "elementFactory", "cmElementFactory", "eventBus", "elementRegistry"];

  constructor(
    private readonly canvas: Canvas,
    private readonly elementFactory: ElementFactory,
    private readonly factory: CmElementFactory,
    private readonly eventBus: EventBus,
    private readonly elementRegistry: ElementRegistry,
  ) {}

  import(doc: CmDocument): ImportWarning[] {
    const warnings: ImportWarning[] = [];
    this.eventBus.fire("import.render.start", { document: doc });

    let existing: RootWithMeta | undefined;
    try {
      existing = this.canvas.getRootElement() as RootWithMeta;
    } catch {
      existing = undefined;
    }
    let root: RootWithMeta;
    if (existing && existing.id === ROOT_ID) {
      root = existing;
    } else {
      root = this.elementFactory.createRoot({ id: ROOT_ID }) as RootWithMeta;
      this.canvas.setRootElement(root);
    }
    root.businessObject = { title: doc.title };

    const byId = new Map<string, CmContext>();
    for (const ctx of doc.contexts) {
      const shape = this.factory.createContext(ctx);
      byId.set(ctx.id, shape);
    }

    // Connections first (back), then contexts (front).
    for (const rel of doc.relationships) {
      const source = byId.get(rel.from);
      const target = byId.get(rel.to);
      if (!source || !target) {
        warnings.push({
          message: `Relationship "${rel.id}" references a missing context; skipped.`,
          elementId: rel.id,
        });
        continue;
      }
      const waypoints: Point[] = [
        borderPoint(source as unknown as Rect, centre(target as unknown as Rect)),
        borderPoint(target as unknown as Rect, centre(source as unknown as Rect)),
      ];
      const connection = this.factory.createRelationship(rel, source, target, waypoints);
      this.canvas.addConnection(connection, root);
    }
    for (const shape of byId.values()) {
      this.canvas.addShape(shape, root);
    }

    this.eventBus.fire("import.render.done", { warnings });
    return warnings;
  }

  /** Removes every element (for re-import). */
  clear(): void {
    for (const el of [...this.elementRegistry.getAll()]) {
      if (el.id === ROOT_ID) continue;
      try {
        if ("waypoints" in el) this.canvas.removeConnection(el.id);
        else this.canvas.removeShape(el.id);
      } catch {
        // already removed — ignore
      }
    }
  }
}
