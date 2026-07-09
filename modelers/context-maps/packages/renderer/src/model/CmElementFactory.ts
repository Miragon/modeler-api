/**
 * Creates diagram-js runtime elements carrying Context Maps markers: bounded
 * contexts (shapes) and relationships (connections), from canonical document
 * elements (import) or from scratch (palette / context-pad create).
 */

import type ElementFactory from "diagram-js/lib/core/ElementFactory";
import type { Point } from "diagram-js/lib/util/Types";
import { SUBDOMAIN_TYPE_SPECS, newId } from "@miragon/context-maps-schema-model";
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
    return this.elementFactory.createShape({
      id: ctx.id,
      x: ctx.position.x,
      y: ctx.position.y,
      width: ctx.size.width,
      height: ctx.size.height,
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
      ...(rel.implementationTechnology
        ? { implementationTechnology: rel.implementationTechnology }
        : {}),
    } as unknown as Partial<CmRelationship>) as unknown as CmRelationship;
  }

  // --- fresh, not-yet-placed elements (palette / context-pad create) -----
  //
  // These set an explicit model-style id (`ctx_…`/`rel_…`, matching the model
  // package's factory) instead of diagram-js' auto-id, whose counter is not
  // advanced past ids that arrive via import — so a re-imported element would
  // otherwise collide with the next palette create after a reload.

  createNewContext(subdomainType: SubdomainType, label?: string): CmContext {
    const spec = SUBDOMAIN_TYPE_SPECS[subdomainType];
    return this.elementFactory.createShape({
      id: newId("ctx"),
      width: spec.defaultSize.width,
      height: spec.defaultSize.height,
      cmKind: "context",
      subdomainType,
      cmLabel: label ?? "New Context",
    } as Partial<CmContext>) as unknown as CmContext;
  }
}
