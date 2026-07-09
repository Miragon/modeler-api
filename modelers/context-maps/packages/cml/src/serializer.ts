/**
 * Serialises a {@link CmDocument} to Context Mapper CML text (the strategic
 * context-map subset). Separate Ways has no CML relationship keyword, so it is
 * emitted as a comment to preserve intent without producing invalid CML.
 */

import { isSymmetricPattern } from "@miragon/context-maps-schema-model";
import type { BoundedContext, CmDocument, Relationship } from "@miragon/context-maps-schema-model";

/** Turns arbitrary text into a valid, unique CML identifier. */
function makeNamer(contexts: BoundedContext[]): (ctx: BoundedContext) => string {
  const byId = new Map<string, string>();
  const used = new Set<string>();
  for (const ctx of contexts) {
    // Prefer the id when it is already a clean identifier (round-trips CML imports),
    // otherwise derive one from the label.
    const source = /^[A-Za-z][A-Za-z0-9_]*$/.test(ctx.id) ? ctx.id : ctx.label;
    let base =
      source
        .replace(/[^A-Za-z0-9]+/g, " ")
        .trim()
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join("") || "Context";
    if (/^[0-9]/.test(base)) base = "C" + base;
    let name = base;
    let n = 2;
    while (used.has(name)) name = `${base}${n++}`;
    used.add(name);
    byId.set(ctx.id, name);
  }
  return (ctx) => byId.get(ctx.id) ?? ctx.id;
}

function sanitizeMapName(title: string): string {
  const base = title
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  return /^[A-Za-z]/.test(base) ? base : "ContextMap";
}

function relationshipLine(rel: Relationship, name: (id: string) => string): string {
  const from = name(rel.from);
  const to = name(rel.to);
  const suffix = rel.implementationTechnology
    ? ` {\n    implementationTechnology = "${rel.implementationTechnology}"\n  }`
    : "";

  if (isSymmetricPattern(rel.pattern)) {
    if (rel.pattern === "partnership") return `  ${from} [P]<->[P] ${to}`;
    if (rel.pattern === "shared-kernel") return `  ${from} [SK]<->[SK] ${to}`;
    // separate-ways has no CML keyword — preserve as a comment.
    return `  // Separate Ways: ${from} and ${to}`;
  }

  const up = [
    "U",
    ...(rel.pattern === "customer-supplier" ? ["S"] : []),
    ...(rel.upstreamRoles ?? []),
  ];
  const down = [
    "D",
    ...(rel.pattern === "customer-supplier" ? ["C"] : []),
    ...(rel.downstreamRoles ?? []),
  ];
  return `  ${from} [${up.join(",")}]->[${down.join(",")}] ${to}${suffix}`;
}

export function serializeCml(doc: CmDocument): string {
  const name = makeNamer(doc.contexts);
  const byId = (id: string): string => {
    const ctx = doc.contexts.find((c) => c.id === id);
    return ctx ? name(ctx) : id;
  };

  const contextNames = doc.contexts.map(name);
  const lines: string[] = [];
  lines.push(`ContextMap ${sanitizeMapName(doc.title)} {`);
  lines.push(`  type = SYSTEM_LANDSCAPE`);
  lines.push(`  state = AS_IS`);
  lines.push("");
  if (contextNames.length) lines.push(`  contains ${contextNames.join(", ")}`);
  if (doc.relationships.length) {
    lines.push("");
    for (const rel of doc.relationships) lines.push(relationshipLine(rel, byId));
  }
  lines.push("}");
  lines.push("");

  // Emit a minimal BoundedContext stub per context so the CML is self-contained.
  for (const ctx of doc.contexts) {
    lines.push(`BoundedContext ${name(ctx)}`);
  }
  lines.push("");
  return lines.join("\n");
}
