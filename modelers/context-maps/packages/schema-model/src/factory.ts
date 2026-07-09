/**
 * Factory helpers for constructing well-formed model objects with the correct
 * notation defaults (sizes, labels). Kept DOM-free.
 */

import { nanoid } from "nanoid";
import { SUBDOMAIN_TYPE_SPECS } from "./notation";
import type {
  BoundedContext,
  DownstreamRole,
  Position,
  Relationship,
  RelationshipPattern,
  SubdomainType,
  UpstreamRole,
  CmDocument,
} from "./types";
import { DOCUMENT_VERSION, isSymmetricPattern } from "./types";

export function newId(prefix: string): string {
  return `${prefix}_${nanoid(8)}`;
}

/** Creates a bounded context of the given subdomain type, with notation defaults. */
export function createBoundedContext(
  subdomainType: SubdomainType,
  position: Position,
  overrides: Partial<Omit<BoundedContext, "id">> = {},
): BoundedContext {
  const spec = SUBDOMAIN_TYPE_SPECS[subdomainType];
  return {
    id: newId("ctx"),
    label: overrides.label ?? "New Context",
    subdomainType,
    team: overrides.team,
    description: overrides.description,
    position,
    size: overrides.size ?? { ...spec.defaultSize },
    fill: overrides.fill,
    stroke: overrides.stroke,
  };
}

/** Creates a relationship between two contexts, with pattern defaults. */
export function createRelationship(
  from: string,
  to: string,
  pattern: RelationshipPattern,
  overrides: Partial<Omit<Relationship, "id" | "from" | "to" | "pattern">> = {},
): Relationship {
  const rel: Relationship = {
    id: newId("rel"),
    from,
    to,
    pattern,
  };
  // Roles only make sense on asymmetric patterns.
  if (!isSymmetricPattern(pattern)) {
    if (overrides.upstreamRoles?.length)
      rel.upstreamRoles = [...overrides.upstreamRoles] as UpstreamRole[];
    if (overrides.downstreamRoles?.length)
      rel.downstreamRoles = [...overrides.downstreamRoles] as DownstreamRole[];
  }
  if (overrides.label) rel.label = overrides.label;
  if (overrides.implementationTechnology)
    rel.implementationTechnology = overrides.implementationTechnology;
  return rel;
}

/** An empty document with sensible defaults. */
export function emptyDocument(title = "Untitled context map"): CmDocument {
  return {
    version: DOCUMENT_VERSION,
    title,
    contexts: [],
    relationships: [],
  };
}
