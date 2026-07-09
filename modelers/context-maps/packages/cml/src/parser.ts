/**
 * A pragmatic parser for the strategic (context-map) subset of Context Mapper's
 * CML. It recognises `ContextMap { ... }` with `contains` declarations and
 * relationship statements (bracket-arrow and keyword forms), and maps them onto
 * a {@link CmDocument}.
 *
 * It is intentionally NOT a full CML implementation: tactical DDD constructs
 * (Aggregate, Entity, Service, ...) and standalone `BoundedContext { ... }`
 * bodies are skipped and reported as diagnostics rather than parsed. Parsing is
 * a linear scan (no Xtext, no backtracking regexes over untrusted input).
 */

import {
  DOCUMENT_VERSION,
  SUBDOMAIN_TYPE_SPECS,
  isSymmetricPattern,
} from "@miragon/context-maps-schema-model";
import type {
  BoundedContext,
  CmDocument,
  DownstreamRole,
  Relationship,
  RelationshipPattern,
  UpstreamRole,
} from "@miragon/context-maps-schema-model";

export interface CmlDiagnostic {
  severity: "warning" | "error";
  message: string;
}

export interface CmlParseResult {
  document: CmDocument;
  diagnostics: CmlDiagnostic[];
}

/** Strips `//` line comments and `/* *\/` block comments. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

/** Extracts the balanced `{ ... }` body starting at the first brace after `from`. */
function extractBraceBody(text: string, from: number): { body: string; end: number } | null {
  const open = text.indexOf("{", from);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return { body: text.slice(open + 1, i), end: i };
    }
  }
  return null;
}

function parseBracket(bracket: string | undefined): string[] {
  if (!bracket) return [];
  return bracket
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Keyword relationship forms. `reversed` marks keywords where the LEFT operand
 * is the downstream side: in CML `A Customer-Supplier B`, A is the customer
 * (downstream) and B the supplier (upstream) — the arrow-free keyword encodes
 * the direction, not the operand order.
 */
const KEYWORD_PATTERN: Record<string, { pattern: RelationshipPattern; reversed?: boolean }> = {
  PARTNERSHIP: { pattern: "partnership" },
  "SHARED-KERNEL": { pattern: "shared-kernel" },
  SHAREDKERNEL: { pattern: "shared-kernel" },
  "CUSTOMER-SUPPLIER": { pattern: "customer-supplier", reversed: true },
  "SUPPLIER-CUSTOMER": { pattern: "customer-supplier" },
  "UPSTREAM-DOWNSTREAM": { pattern: "upstream-downstream" },
  "DOWNSTREAM-UPSTREAM": { pattern: "upstream-downstream", reversed: true },
  "SEPARATE-WAYS": { pattern: "separate-ways" },
};

function toUpstreamRoles(tokens: string[]): UpstreamRole[] {
  const roles: UpstreamRole[] = [];
  if (tokens.includes("OHS")) roles.push("OHS");
  if (tokens.includes("PL")) roles.push("PL");
  return roles;
}

function toDownstreamRoles(tokens: string[]): DownstreamRole[] {
  const roles: DownstreamRole[] = [];
  if (tokens.includes("ACL")) roles.push("ACL");
  if (tokens.includes("CF") || tokens.includes("CONFORMIST")) roles.push("CF");
  return roles;
}

let relCounter = 0;
function relId(): string {
  relCounter += 1;
  return `rel_cml_${relCounter}`;
}

interface RawRelationship {
  from: string;
  to: string;
  pattern: RelationshipPattern;
  upstreamRoles?: UpstreamRole[];
  downstreamRoles?: DownstreamRole[];
  implementationTechnology?: string;
}

const KNOWN_BRACKET_TOKENS = new Set([
  "U",
  "D",
  "S",
  "C",
  "P",
  "SK",
  "OHS",
  "PL",
  "ACL",
  "CF",
  "CONFORMIST",
]);

/** Parses a single relationship statement (bracket-arrow or keyword form). */
function parseRelationshipStatement(
  stmt: string,
  diagnostics: CmlDiagnostic[],
): RawRelationship | null {
  const body = extractBraceBody(stmt, 0);
  const head = body ? stmt.slice(0, stmt.indexOf("{")) : stmt;
  let implementationTechnology: string | undefined;
  if (body) {
    const m = body.body.match(/implementationTechnology\s*=\s*"([^"]*)"/);
    if (m) implementationTechnology = m[1];
  }

  // Bracket-arrow form: A [roles]? (<->|->|<-) [roles]? B
  const arrow = head.match(/(\w+)\s*(\[[^\]]*\])?\s*(<->|->|<-)\s*(\[[^\]]*\])?\s*(\w+)/);
  if (arrow) {
    const [, leftName, leftBracket, dir, rightBracket, rightName] = arrow;
    const leftTokens = parseBracket(leftBracket);
    const rightTokens = parseBracket(rightBracket);
    for (const token of [...leftTokens, ...rightTokens]) {
      if (!KNOWN_BRACKET_TOKENS.has(token)) {
        diagnostics.push({
          severity: "warning",
          message: `Unknown role "${token}" in "${leftName} … ${rightName}"; ignored.`,
        });
      }
    }

    if (dir === "<->") {
      const all = [...leftTokens, ...rightTokens];
      const pattern: RelationshipPattern = all.includes("SK") ? "shared-kernel" : "partnership";
      return { from: leftName, to: rightName, pattern };
    }

    // Orient: for `->` the left is upstream; for `<-` the right is upstream.
    const upstreamName = dir === "->" ? leftName : rightName;
    const downstreamName = dir === "->" ? rightName : leftName;
    const upstreamTokens = dir === "->" ? leftTokens : rightTokens;
    const downstreamTokens = dir === "->" ? rightTokens : leftTokens;

    const isCustomerSupplier = upstreamTokens.includes("S") || downstreamTokens.includes("C");
    const pattern: RelationshipPattern = isCustomerSupplier
      ? "customer-supplier"
      : "upstream-downstream";
    const upstreamRoles = toUpstreamRoles(upstreamTokens);
    const downstreamRoles = toDownstreamRoles(downstreamTokens);
    return {
      from: upstreamName,
      to: downstreamName,
      pattern,
      upstreamRoles: upstreamRoles.length ? upstreamRoles : undefined,
      downstreamRoles: downstreamRoles.length ? downstreamRoles : undefined,
      implementationTechnology,
    };
  }

  // Keyword form: A <Keyword> B
  const keyword = head.match(/(\w+)\s+([A-Za-z-]+)\s+(\w+)/);
  if (keyword) {
    const entry = KEYWORD_PATTERN[keyword[2].toUpperCase()];
    if (entry) {
      const [from, to] = entry.reversed ? [keyword[3], keyword[1]] : [keyword[1], keyword[3]];
      return { from, to, pattern: entry.pattern };
    }
  }
  return null;
}

/** Auto-lays out contexts in a grid (CML carries no geometry). */
function layout(index: number): { x: number; y: number } {
  const cols = 3;
  const col = index % cols;
  const row = Math.floor(index / cols);
  return { x: 60 + col * 320, y: 80 + row * 220 };
}

export function parseCml(text: string): CmlParseResult {
  relCounter = 0;
  const diagnostics: CmlDiagnostic[] = [];

  // Separate Ways has no CML relationship keyword; the serializer preserves it
  // as a `// Separate Ways: A and B` comment. Recover those markers before the
  // comments are stripped so the pattern survives a CML round-trip.
  const separateWays: Array<{ from: string; to: string }> = [];
  for (const m of text.matchAll(/\/\/\s*Separate Ways:\s*(\w+)\s+and\s+(\w+)/gi)) {
    separateWays.push({ from: m[1], to: m[2] });
  }

  const clean = stripComments(text);

  const mapStart = clean.match(/ContextMap\s+(\w+)?/);
  if (!mapStart) {
    return {
      document: {
        version: DOCUMENT_VERSION,
        title: "Imported context map",
        contexts: [],
        relationships: [],
      },
      diagnostics: [{ severity: "error", message: "No `ContextMap` block found." }],
    };
  }
  const title = mapStart[1] ?? "Imported context map";
  const brace = extractBraceBody(clean, mapStart.index ?? 0);
  if (!brace) {
    return {
      document: { version: DOCUMENT_VERSION, title, contexts: [], relationships: [] },
      diagnostics: [{ severity: "error", message: "Unterminated `ContextMap { ... }` block." }],
    };
  }
  const mapBody = brace.body;

  // Collect context names from `contains` declarations (comma or whitespace separated).
  const names = new Set<string>();
  for (const m of mapBody.matchAll(/contains\s+([A-Za-z0-9_,\s]+?)(?=\n|contains|$)/g)) {
    for (const raw of m[1].split(/[,\s]+/)) {
      const name = raw.trim();
      if (name) names.add(name);
    }
  }

  // Parse relationship statements: strip `contains`/`type`/`state` lines, then split.
  const withoutMeta = mapBody
    .replace(/contains\s+[A-Za-z0-9_,\s]+?(?=\n|$)/g, "\n")
    .replace(/\b(type|state)\s*=\s*\w+/g, "\n");

  const rawRels: RawRelationship[] = [];
  // Match a relationship head plus an optional brace body.
  const stmtRe =
    /(\w+\s*(?:\[[^\]]*\])?\s*(?:<->|->|<-)\s*(?:\[[^\]]*\])?\s*\w+|\w+\s+[A-Za-z-]+\s+\w+)(\s*\{[^}]*\})?/g;
  for (const m of withoutMeta.matchAll(stmtRe)) {
    const stmt = m[1] + (m[2] ?? "");
    const rel = parseRelationshipStatement(stmt, diagnostics);
    if (rel) {
      rawRels.push(rel);
      names.add(rel.from);
      names.add(rel.to);
    } else if (/<->|->|<-/.test(m[1])) {
      // An arrow makes the intent unambiguous — surface the drop instead of
      // silently losing a relationship. Keyword-form misses stay silent (any
      // three words match that shape, so warning would be too noisy).
      diagnostics.push({
        severity: "warning",
        message: `Could not parse relationship statement "${m[1].trim()}"; skipped.`,
      });
    }
  }
  for (const sw of separateWays) {
    if (sw.from === sw.to) continue;
    rawRels.push({ from: sw.from, to: sw.to, pattern: "separate-ways" });
    names.add(sw.from);
    names.add(sw.to);
  }

  const orderedNames = [...names];
  const contexts: BoundedContext[] = orderedNames.map((name, i) => ({
    id: name,
    label: name,
    position: layout(i),
    size: { ...SUBDOMAIN_TYPE_SPECS.supporting.defaultSize },
  }));

  const relationships: Relationship[] = rawRels.map((r) => {
    const rel: Relationship = { id: relId(), from: r.from, to: r.to, pattern: r.pattern };
    if (!isSymmetricPattern(r.pattern)) {
      if (r.upstreamRoles?.length) rel.upstreamRoles = r.upstreamRoles;
      if (r.downstreamRoles?.length) rel.downstreamRoles = r.downstreamRoles;
    }
    if (r.implementationTechnology) rel.implementationTechnology = r.implementationTechnology;
    return rel;
  });

  return {
    document: { version: DOCUMENT_VERSION, title, contexts, relationships },
    diagnostics,
  };
}
