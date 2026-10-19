/**
 * Rebuilds a canonical `CmDocument` from the diagram-js runtime model. Position
 * and size truth are the live `x/y/width/height`; editable fields (label,
 * subdomain, team, pattern, roles, colours) are read from runtime properties.
 */

import type ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import type { Root } from "diagram-js/lib/model/Types";
import { DOCUMENT_VERSION } from "@miragon/context-maps-schema-model";
import type { BoundedContext, Relationship, CmDocument } from "@miragon/context-maps-schema-model";
import { isCmContext, isCmRelationship } from "../model/di-types.js";
import { ROOT_ID, type RootBusinessObject } from "./types.js";

export default class CmExporter {
  static $inject = ["elementRegistry"];

  constructor(private readonly elementRegistry: ElementRegistry) {}

  export(): CmDocument {
    // Through the registry: asking the canvas would create an implicit root before the first import.
    const root = this.elementRegistry.get(ROOT_ID) as
      (Root & { businessObject?: RootBusinessObject }) | undefined;
    const meta = root?.businessObject;

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
          ...el.cmForeign,
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
          ...el.cmForeign,
        });
      }
    }
    relationships.push(...(meta?.unplacedRelationships ?? []));

    return {
      version: DOCUMENT_VERSION,
      title: meta?.title ?? "Untitled context map",
      contexts,
      relationships,
      ...meta?.foreign,
    };
  }
}
