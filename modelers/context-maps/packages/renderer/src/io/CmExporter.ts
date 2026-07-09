/**
 * Rebuilds a canonical `CmDocument` from the diagram-js runtime model. Position
 * and size truth are the live `x/y/width/height`; editable fields (label,
 * subdomain, team, pattern, roles, colours) are read from runtime properties.
 */

import type Canvas from "diagram-js/lib/core/Canvas";
import type ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import type { Root } from "diagram-js/lib/model/Types";
import { DOCUMENT_VERSION } from "@miragon/context-maps-schema-model";
import type { BoundedContext, Relationship, CmDocument } from "@miragon/context-maps-schema-model";
import { isCmContext, isCmRelationship } from "../model/di-types.js";
import { ROOT_ID, type RootBusinessObject } from "./types.js";

export default class CmExporter {
  static $inject = ["elementRegistry", "canvas"];

  constructor(
    private readonly elementRegistry: ElementRegistry,
    private readonly canvas: Canvas,
  ) {}

  export(): CmDocument {
    let meta: RootBusinessObject | undefined;
    try {
      const root = this.canvas.getRootElement() as Root & {
        businessObject?: RootBusinessObject;
      };
      meta = root.businessObject;
    } catch {
      meta = undefined;
    }

    const contexts: BoundedContext[] = [];
    const relationships: Relationship[] = [];

    for (const el of this.elementRegistry.getAll()) {
      if (el.id === ROOT_ID) continue;

      if (isCmContext(el)) {
        const geom = el as unknown as { x: number; y: number; width: number; height: number };
        contexts.push({
          id: el.id,
          label: el.cmLabel ?? "",
          position: { x: geom.x, y: geom.y },
          size: { width: geom.width, height: geom.height },
          ...(el.subdomainType ? { subdomainType: el.subdomainType } : {}),
          ...(el.team ? { team: el.team } : {}),
          ...(el.description ? { description: el.description } : {}),
          ...(el.fill ? { fill: el.fill } : {}),
          ...(el.stroke ? { stroke: el.stroke } : {}),
        });
      } else if (isCmRelationship(el)) {
        const source = el.source as { id?: string } | undefined;
        const target = el.target as { id?: string } | undefined;
        if (!source?.id || !target?.id) continue;
        relationships.push({
          id: el.id,
          from: source.id,
          to: target.id,
          pattern: el.pattern,
          ...(el.upstreamRoles?.length ? { upstreamRoles: [...el.upstreamRoles] } : {}),
          ...(el.downstreamRoles?.length ? { downstreamRoles: [...el.downstreamRoles] } : {}),
          ...(el.cmLabel ? { label: el.cmLabel } : {}),
          ...(el.description ? { description: el.description } : {}),
          ...(el.implementationTechnology
            ? { implementationTechnology: el.implementationTechnology }
            : {}),
        });
      }
    }

    return {
      version: DOCUMENT_VERSION,
      title: meta?.title ?? "Untitled context map",
      contexts,
      relationships,
    };
  }
}
