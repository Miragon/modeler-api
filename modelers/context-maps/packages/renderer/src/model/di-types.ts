/**
 * diagram-js runtime model for the Context Maps notation.
 *
 *  - `context`      — a bounded context: a placed, resizable SHAPE (box) with a
 *                     label, optional owning team and subdomain classification.
 *  - `relationship` — a context-mapping pattern: a CONNECTION (edge) between two
 *                     contexts, carrying a pattern plus upstream/downstream roles.
 *
 * These runtime properties are the source of truth while editing; the exporter
 * rebuilds the canonical `CmDocument` from them.
 */

import type { Connection, Shape } from "diagram-js/lib/model/Types";
import type {
  DownstreamRole,
  RelationshipPattern,
  SubdomainType,
  UpstreamRole,
} from "@miragon/context-maps-schema-model";

export type CmKind = "context" | "relationship";

export interface CmContext extends Shape {
  cmKind: "context";
  subdomainType?: SubdomainType;
  /** Display name (separate from diagram-js `label`). */
  cmLabel?: string;
  team?: string;
  description?: string;
  fill?: string;
  stroke?: string;
}

export interface CmRelationship extends Connection {
  cmKind: "relationship";
  pattern: RelationshipPattern;
  upstreamRoles?: UpstreamRole[];
  downstreamRoles?: DownstreamRole[];
  cmLabel?: string;
  implementationTechnology?: string;
}

export type CmElement = CmContext | CmRelationship;

function kindOf(el: unknown): string | undefined {
  return typeof el === "object" && el !== null
    ? ((el as { cmKind?: unknown }).cmKind as string | undefined)
    : undefined;
}

export function isCmElement(el: unknown): el is CmElement {
  return typeof kindOf(el) === "string";
}

export function isCmContext(el: unknown): el is CmContext {
  return kindOf(el) === "context";
}

export function isCmRelationship(el: unknown): el is CmRelationship {
  return kindOf(el) === "relationship";
}
