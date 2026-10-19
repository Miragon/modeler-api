/**
 * Deterministic serialisation of the document model.
 *
 * Producing byte-stable JSON (sorted arrays, fixed key order, rounded
 * coordinates) makes context maps diff-friendly in version control and gives
 * stable share URLs / embedded payloads.
 */

import { DOCUMENT_VERSION } from "./types";
import type { BoundedContext, Position, Relationship, Size, CmDocument } from "./types";
import { CONTEXT_KEYS, DOCUMENT_KEYS, RELATIONSHIP_KEYS, withForeignFields } from "./foreign";

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

/** Drops undefined fields and applies a fixed key order to a context, its foreign keys last. */
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
  return withForeignFields(out, c, CONTEXT_KEYS);
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
  return withForeignFields(out, r, RELATIONSHIP_KEYS);
}

const byId = (a: { id: string }, b: { id: string }): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/**
 * Returns a canonicalised copy of a document (sorted, rounded, version-stamped). Keys this version
 * does not know follow the known keys of their object, sorted by name; their values stay as they
 * are.
 */
export function canonicalize(doc: CmDocument): CmDocument {
  return withForeignFields(
    {
      version: DOCUMENT_VERSION,
      title: doc.title,
      contexts: [...doc.contexts].map(normContext).sort(byId),
      relationships: [...doc.relationships].map(normRelationship).sort(byId),
    },
    doc,
    DOCUMENT_KEYS,
  );
}

/** Serialises a document to deterministic, pretty-printed JSON. */
export function serializeDocument(doc: CmDocument, pretty = true): string {
  const canonical = canonicalize(doc);
  return JSON.stringify(canonical, null, pretty ? 2 : 0);
}

/**
 * The canonical text of a `.cm`/`.cm.json` file: the pretty-printed canonical JSON ending in one
 * line break, as editors (and `insertFinalNewline`) write text files. The text lane of the
 * collaborative-modeler contract.
 */
export function serializeDocumentText(doc: CmDocument): string {
  return `${serializeDocument(doc, true)}\n`;
}
