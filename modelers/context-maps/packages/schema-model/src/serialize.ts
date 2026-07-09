/**
 * Deterministic serialisation of the document model.
 *
 * Producing byte-stable JSON (sorted arrays, fixed key order, rounded
 * coordinates) makes context maps diff-friendly in version control and gives
 * stable share URLs / embedded payloads.
 */

import { DOCUMENT_VERSION } from "./types";
import type { BoundedContext, Position, Relationship, Size, CmDocument } from "./types";

/** Round to 2 decimals to strip floating-point drift from drag operations. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function normPosition(p: Position): Position {
  return { x: round(p.x), y: round(p.y) };
}

function normSize(s: Size): Size {
  return { width: round(s.width), height: round(s.height) };
}

/** Drops undefined fields and applies a fixed key order to a context. */
function normContext(c: BoundedContext): BoundedContext {
  const out: BoundedContext = {
    id: c.id,
    label: c.label,
    position: normPosition(c.position),
    size: normSize(c.size),
  };
  if (c.subdomainType) out.subdomainType = c.subdomainType;
  if (c.team) out.team = c.team;
  if (c.description) out.description = c.description;
  if (c.fill) out.fill = c.fill;
  if (c.stroke) out.stroke = c.stroke;
  return out;
}

function normRelationship(r: Relationship): Relationship {
  const out: Relationship = {
    id: r.id,
    from: r.from,
    to: r.to,
    pattern: r.pattern,
  };
  if (r.upstreamRoles?.length) out.upstreamRoles = [...r.upstreamRoles].sort();
  if (r.downstreamRoles?.length) out.downstreamRoles = [...r.downstreamRoles].sort();
  if (r.label) out.label = r.label;
  if (r.description) out.description = r.description;
  if (r.implementationTechnology) out.implementationTechnology = r.implementationTechnology;
  return out;
}

const byId = (a: { id: string }, b: { id: string }): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/** Returns a canonicalised copy of a document (sorted, rounded, version-stamped). */
export function canonicalize(doc: CmDocument): CmDocument {
  return {
    version: DOCUMENT_VERSION,
    title: doc.title,
    contexts: [...doc.contexts].map(normContext).sort(byId),
    relationships: [...doc.relationships].map(normRelationship).sort(byId),
  };
}

/** Serialises a document to deterministic, pretty-printed JSON. */
export function serializeDocument(doc: CmDocument, pretty = true): string {
  const canonical = canonicalize(doc);
  return JSON.stringify(canonical, null, pretty ? 2 : 0);
}
