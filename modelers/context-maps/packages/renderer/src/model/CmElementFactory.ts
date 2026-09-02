/**
 * Creates diagram-js runtime elements carrying Context Maps markers: bounded
 * contexts (shapes) and relationships (connections), from canonical document
 * elements (import) or from scratch (palette / context-pad create).
 */

import type ElementFactory from "diagram-js/lib/core/ElementFactory";
import type { Point } from "diagram-js/lib/util/Types";
import { SUBDOMAIN_TYPE_SPECS } from "@miragon/context-maps-schema-model";
import type {
  BoundedContext,
  Relationship,
  SubdomainType,
} from "@miragon/context-maps-schema-model";
import type { CmContext, CmRelationship } from "./di-types.js";

export default class CmElementFactory {
  static $inject = ["elementFactory"];

  constructor(private readonly elementFactory: ElementFactory) {}

  // --- from canonical document elements (import) -------------------------

  createContext(ctx: BoundedContext): CmContext {
    // Boxes are fixed-size on the canvas (no resize feature) — clamp legacy or
    // hand-edited imports up to the notation minimum so the fixed name/team
    // layout always fits inside the box.
    const spec = ctx.subdomainType ? SUBDOMAIN_TYPE_SPECS[ctx.subdomainType] : undefined;
    const minSize = spec?.minSize ?? { width: 120, height: 72 };
    return this.elementFactory.createShape({
      id: ctx.id,
      x: ctx.position.x,
      y: ctx.position.y,
      width: Math.max(ctx.size.width, minSize.width),
      height: Math.max(ctx.size.height, minSize.height),
      cmKind: "context",
      cmLabel: ctx.label,
      ...(ctx.subdomainType ? { subdomainType: ctx.subdomainType } : {}),
      ...(ctx.team ? { team: ctx.team } : {}),
      ...(ctx.description ? { description: ctx.description } : {}),
      ...(ctx.fill ? { fill: ctx.fill } : {}),
      ...(ctx.stroke ? { stroke: ctx.stroke } : {}),
    } as Partial<CmContext>) as unknown as CmContext;
  }

  createRelationship(
    rel: Relationship,
    source: CmContext,
    target: CmContext,
    waypoints: Point[],
  ): CmRelationship {
    return this.elementFactory.createConnection({
      id: rel.id,
      source,
      target,
      waypoints,
      cmKind: "relationship",
      pattern: rel.pattern,
      ...(rel.upstreamRoles?.length ? { upstreamRoles: [...rel.upstreamRoles] } : {}),
      ...(rel.downstreamRoles?.length ? { downstreamRoles: [...rel.downstreamRoles] } : {}),
      ...(rel.label ? { cmLabel: rel.label } : {}),
      ...(rel.description ? { description: rel.description } : {}),
      ...(rel.implementationTechnology
        ? { implementationTechnology: rel.implementationTechnology }
        : {}),
    } as unknown as Partial<CmRelationship>) as unknown as CmRelationship;
  }

  // --- fresh, not-yet-placed elements (palette / context-pad create) -----
  //
  // No explicit id: the element factory (CmDiagramElementFactory) assigns a
  // collision-free model-style id (`ctx_…`).

  /** No type → an unclassified context (the pad's append action starts blank). */
  createNewContext(subdomainType?: SubdomainType, label?: string): CmContext {
    // Every type shares one default size; generic serves as the neutral fallback.
    const size =
      (subdomainType ? SUBDOMAIN_TYPE_SPECS[subdomainType] : undefined)?.defaultSize ??
      SUBDOMAIN_TYPE_SPECS.generic.defaultSize;
    return this.elementFactory.createShape({
      width: size.width,
      height: size.height,
      cmKind: "context",
      ...(subdomainType ? { subdomainType } : {}),
      cmLabel: label ?? "New Context",
    } as Partial<CmContext>) as unknown as CmContext;
  }
}
