/**
 * Pure (DOM-free) domain types for the Context Maps model.
 *
 * This module is the canonical representation of a Domain-Driven Design context
 * map and must never import from the rendering layer (diagram-js) or touch the
 * DOM, so it can be unit-tested in isolation and reused across views / exporters.
 *
 * The vocabulary deliberately mirrors Context Mapper's CML (OHS, PL, ACL, CF,
 * Partnership, Shared Kernel, Customer-Supplier, Upstream-Downstream) so maps
 * stay interoperable with the wider strategic-DDD tooling ecosystem, while the
 * native serialisation format stays lean JSON.
 */

/** MIME type used when dragging a subdomain type from the palette onto the canvas. */
export const DND_MIME = "application/x-cm-subdomain-type";

/**
 * The strategic classification of a bounded context's subdomain.
 * Drives colour in the notation (core = warm, generic = cool).
 */
export type SubdomainType = "core" | "supporting" | "generic";

export const SUBDOMAIN_TYPES: readonly SubdomainType[] = ["core", "supporting", "generic"] as const;

/**
 * The relationship (context-mapping) pattern between two bounded contexts.
 *
 *  - `partnership`, `shared-kernel`, `separate-ways` are SYMMETRIC (no
 *    upstream/downstream direction; `from`/`to` are just the two partners).
 *  - `customer-supplier`, `upstream-downstream` are ASYMMETRIC: `from` is the
 *    upstream/supplier, `to` is the downstream/customer.
 */
export type RelationshipPattern =
  | "partnership" // P
  | "shared-kernel" // SK
  | "customer-supplier" // C/S
  | "upstream-downstream" // U/D (generic)
  | "separate-ways"; // SW

export const RELATIONSHIP_PATTERNS: readonly RelationshipPattern[] = [
  "partnership",
  "shared-kernel",
  "customer-supplier",
  "upstream-downstream",
  "separate-ways",
] as const;

/** Patterns without a directional upstream/downstream distinction. */
export const SYMMETRIC_PATTERNS: readonly RelationshipPattern[] = [
  "partnership",
  "shared-kernel",
  "separate-ways",
] as const;

export function isSymmetricPattern(pattern: RelationshipPattern): boolean {
  return SYMMETRIC_PATTERNS.includes(pattern);
}

/** Integration role the UPSTREAM context can implement. */
export type UpstreamRole = "OHS" | "PL"; // Open Host Service / Published Language

export const UPSTREAM_ROLES: readonly UpstreamRole[] = ["OHS", "PL"] as const;

/** Integration role the DOWNSTREAM context can apply. */
export type DownstreamRole = "ACL" | "CF"; // Anticorruption Layer / Conformist

export const DOWNSTREAM_ROLES: readonly DownstreamRole[] = ["ACL", "CF"] as const;

/** Geometric size of a shape in canvas units (px). */
export interface Size {
  width: number;
  height: number;
}

/** Position of a shape on the canvas in canvas units (px). */
export interface Position {
  x: number;
  y: number;
}

/** A bounded context — the boxes on a context map. */
export interface BoundedContext {
  id: string;
  label: string;
  /** Strategic subdomain classification; drives the box colour. */
  subdomainType?: SubdomainType;
  /** Owning team (one team per context is the DDD ideal). */
  team?: string;
  description?: string;
  position: Position;
  size: Size;
  fill?: string;
  stroke?: string;
}

/**
 * A relationship (context-mapping pattern) between two bounded contexts.
 *
 * This is a connecting edge: `from` → `to` references two contexts. For
 * asymmetric patterns `from` is upstream and `to`
 * is downstream; the integration roles (`upstreamRoles` / `downstreamRoles`)
 * then decorate the respective ends.
 */
export interface Relationship {
  id: string;
  /** Upstream / first symmetric partner (a context id). */
  from: string;
  /** Downstream / second symmetric partner (a context id). */
  to: string;
  pattern: RelationshipPattern;
  /** Roles on the upstream end (asymmetric patterns only). */
  upstreamRoles?: UpstreamRole[];
  /** Roles on the downstream end (asymmetric patterns only). */
  downstreamRoles?: DownstreamRole[];
  label?: string;
  /** Free-text explanation of the integration, shown on hover in the editor. */
  description?: string;
  /** Free-text integration technology, e.g. "RESTful HTTP" (CML-compatible). */
  implementationTechnology?: string;
}

/** Current document schema version. Bump + add a migration when shape changes. */
export const DOCUMENT_VERSION = 1 as const;

/**
 * A complete context map. This is what gets serialised to JSON, embedded into
 * exported images, and encoded into share URLs.
 */
export interface CmDocument {
  version: typeof DOCUMENT_VERSION;
  title: string;
  contexts: BoundedContext[];
  relationships: Relationship[];
}
