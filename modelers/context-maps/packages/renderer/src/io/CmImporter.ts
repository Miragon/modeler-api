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
import {
  DOCUMENT_KEYS,
  foreignFields,
  reservedIdProblem,
} from "@miragon/context-maps-schema-model";
import type { CmDocument, Relationship } from "@miragon/context-maps-schema-model";
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

  /**
   * Throws when `doc` cannot be drawn: diagram-js keeps one element per id in a plain object, so a
   * duplicate, an id of its own roots or the name of a built-in object property would throw halfway
   * through the import, after the previous document was cleared. Checked before anything is
   * removed, so a rejected import leaves no trace.
   */
  assertImportable(doc: CmDocument): void {
    const seen = new Set<string>();
    for (const { id } of [...doc.contexts, ...doc.relationships]) {
      const reserved = reservedIdProblem(id);
      if (reserved) throw new Error(`Cannot draw the map: ${reserved}.`);
      if (seen.has(id)) throw new Error(`The id "${id}" is used more than once.`);
      seen.add(id);
    }
  }

  import(doc: CmDocument): ImportWarning[] {
    const warnings: ImportWarning[] = [];
    this.eventBus.fire("import.render.start", { document: doc });

    const root = this.documentRoot();
    const foreign = foreignFields(doc, DOCUMENT_KEYS);
    const unplacedRelationships: Relationship[] = [];
    root.businessObject = {
      title: doc.title,
      ...(Object.keys(foreign).length > 0 ? { foreign } : {}),
    };

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
        unplacedRelationships.push(rel);
        warnings.push({
          message: `Relationship "${rel.id}" references a missing context; it stays in the file but is not drawn.`,
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
    if (unplacedRelationships.length > 0)
      root.businessObject.unplacedRelationships = unplacedRelationships;

    this.eventBus.fire("import.render.done", { warnings });
    return warnings;
  }

  /**
   * The document root, created on the first import. Any other root goes: diagram-js creates an
   * implicit one whenever something asks for the root before the first import (an export, a
   * palette create), and it would stay in the registry next to the document's root.
   */
  private documentRoot(): RootWithMeta {
    let root = this.elementRegistry.get(ROOT_ID) as RootWithMeta | undefined;
    if (!root) {
      root = this.elementFactory.createRoot({ id: ROOT_ID }) as RootWithMeta;
      this.canvas.setRootElement(root);
    }
    for (const other of this.canvas.getRootElements()) {
      if (other !== root) this.canvas.removeRootElement(other);
    }
    return root;
  }

  /** Removes every element but the roots (removing a root as a shape corrupts the canvas). */
  clear(): void {
    const roots = new Set<unknown>(this.canvas.getRootElements());
    for (const el of [...this.elementRegistry.getAll()]) {
      if (roots.has(el)) continue;
      try {
        if ("waypoints" in el) this.canvas.removeConnection(el.id);
        else this.canvas.removeShape(el.id);
      } catch {
        // already removed — ignore
      }
    }
  }
}
