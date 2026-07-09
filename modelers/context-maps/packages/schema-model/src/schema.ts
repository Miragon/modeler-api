/**
 * Runtime validation for the context-map document model using Zod, plus the
 * strategic-DDD semantic rules adopted from Context Mapper.
 *
 * Two layers:
 *  - {@link parseDocument} does STRUCTURAL validation (shapes, enums, geometry).
 *    Anything entering the app from outside (files, share URLs, localStorage,
 *    CML import) goes through it so malformed data can never corrupt state.
 *  - {@link validateDocument} does SEMANTIC validation (the 10 relationship
 *    rules). It never blocks loading — the editor shows the findings so an
 *    imperfect (e.g. imported) map can still be opened and fixed.
 */

import { z } from "zod";
import {
  DOCUMENT_VERSION,
  DOWNSTREAM_ROLES,
  RELATIONSHIP_PATTERNS,
  SUBDOMAIN_TYPES,
  UPSTREAM_ROLES,
  isSymmetricPattern,
} from "./types";
import type { CmDocument, Relationship } from "./types";

const subdomainTypeSchema = z.enum(SUBDOMAIN_TYPES as unknown as [string, ...string[]]);
const patternSchema = z.enum(RELATIONSHIP_PATTERNS as unknown as [string, ...string[]]);
const upstreamRoleSchema = z.enum(UPSTREAM_ROLES as unknown as [string, ...string[]]);
const downstreamRoleSchema = z.enum(DOWNSTREAM_ROLES as unknown as [string, ...string[]]);

const sizeSchema = z.object({
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
});

const positionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

const hexColor = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "expected a hex colour");

export const boundedContextSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  subdomainType: subdomainTypeSchema.optional(),
  team: z.string().optional(),
  description: z.string().optional(),
  position: positionSchema,
  size: sizeSchema,
  fill: hexColor.optional(),
  stroke: hexColor.optional(),
});

export const relationshipSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  pattern: patternSchema,
  upstreamRoles: z.array(upstreamRoleSchema).optional(),
  downstreamRoles: z.array(downstreamRoleSchema).optional(),
  label: z.string().optional(),
  implementationTechnology: z.string().optional(),
});

export const documentSchema = z.object({
  version: z.literal(DOCUMENT_VERSION),
  title: z.string(),
  contexts: z.array(boundedContextSchema),
  relationships: z.array(relationshipSchema),
});

export type ParseResult = { ok: true; document: CmDocument } | { ok: false; error: string };

/**
 * Validates and (if necessary) migrates unknown data into a {@link CmDocument}.
 * Returns a discriminated result rather than throwing so callers can show a
 * friendly message.
 */
export function parseDocument(input: unknown): ParseResult {
  const migrated = migrate(input);
  const result = documentSchema.safeParse(migrated);
  if (!result.success) {
    return {
      ok: false,
      error: result.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; "),
    };
  }
  return { ok: true, document: result.data as CmDocument };
}

/**
 * Forward-migrates older/foreign document shapes to the current version. v1 is
 * the first version, so this mostly normalises loosely-shaped input (e.g. from
 * a hand-written file) into the expected container shape.
 */
function migrate(input: unknown): unknown {
  if (input == null || typeof input !== "object") return input;
  const doc = input as Record<string, unknown>;
  const next: Record<string, unknown> = { ...doc };
  next.version = DOCUMENT_VERSION;
  if (typeof next.title !== "string") next.title = "Untitled context map";
  if (!Array.isArray(next.contexts)) next.contexts = [];
  if (!Array.isArray(next.relationships)) next.relationships = [];
  return next;
}

/** A semantic finding on the map, tied to a specific relationship where relevant. */
export interface SemanticFinding {
  /** Rule identifier, e.g. "protect-or-conform". */
  rule: string;
  /** Human-readable explanation for the inspector. */
  message: string;
  /** The offending relationship id, if the finding is relationship-scoped. */
  relationshipId?: string;
}

export interface ValidationReport {
  errors: SemanticFinding[];
  warnings: SemanticFinding[];
}

const label = (r: Relationship): string => r.label?.trim() || r.id;

/**
 * Applies the 10 strategic-DDD semantic rules (adopted from Context Mapper) to a
 * structurally-valid document. Hard violations are `errors`; soft/advisory
 * violations are `warnings`. Never throws and never blocks loading.
 */
export function validateDocument(doc: CmDocument): ValidationReport {
  const errors: SemanticFinding[] = [];
  const warnings: SemanticFinding[] = [];
  const contextIds = new Set(doc.contexts.map((c) => c.id));

  // Rule 10 — unique ids across contexts and relationships.
  const seen = new Set<string>();
  for (const c of doc.contexts) {
    if (seen.has(c.id)) errors.push({ rule: "unique-ids", message: `Duplicate id "${c.id}".` });
    seen.add(c.id);
  }
  for (const r of doc.relationships) {
    if (seen.has(r.id))
      errors.push({ rule: "unique-ids", message: `Duplicate id "${r.id}".`, relationshipId: r.id });
    seen.add(r.id);
  }

  for (const r of doc.relationships) {
    const up = r.upstreamRoles ?? [];
    const down = r.downstreamRoles ?? [];
    const symmetric = isSymmetricPattern(r.pattern);

    // Rule 8 — both endpoints must be contexts on the map.
    if (!contextIds.has(r.from))
      errors.push({
        rule: "endpoints-on-map",
        message: `Relationship "${label(r)}" references unknown context "${r.from}".`,
        relationshipId: r.id,
      });
    if (!contextIds.has(r.to))
      errors.push({
        rule: "endpoints-on-map",
        message: `Relationship "${label(r)}" references unknown context "${r.to}".`,
        relationshipId: r.id,
      });

    // Rule 9 — no self-relationship.
    if (r.from === r.to)
      errors.push({
        rule: "no-self-relationship",
        message: `Relationship "${label(r)}" connects a context to itself.`,
        relationshipId: r.id,
      });

    // Rules 1 & 2 — role placement (guards malformed imports).
    for (const role of up)
      if (!UPSTREAM_ROLES.includes(role))
        errors.push({
          rule: "upstream-roles",
          message: `"${role}" is not a valid upstream role (OHS, PL) in "${label(r)}".`,
          relationshipId: r.id,
        });
    for (const role of down)
      if (!DOWNSTREAM_ROLES.includes(role))
        errors.push({
          rule: "downstream-roles",
          message: `"${role}" is not a valid downstream role (ACL, CF) in "${label(r)}".`,
          relationshipId: r.id,
        });

    // Rule 4 — symmetric relationships carry no integration roles.
    if (symmetric && (up.length > 0 || down.length > 0))
      errors.push({
        rule: "symmetric-integrity",
        message: `"${label(r)}" is a symmetric ${r.pattern} relationship and must not carry OHS/PL/ACL/CF roles.`,
        relationshipId: r.id,
      });

    // Rule 3 — protect OR conform, not both.
    if (down.includes("ACL") && down.includes("CF"))
      errors.push({
        rule: "protect-or-conform",
        message: `"${label(r)}" applies both ACL and CF; choose one.`,
        relationshipId: r.id,
      });

    // Rules 5, 6, 7 — customer-supplier constraints.
    if (r.pattern === "customer-supplier") {
      if (down.includes("CF"))
        errors.push({
          rule: "customer-vs-conformist",
          message: `Conformist (CF) is not applicable in the customer-supplier relationship "${label(r)}"; a customer can negotiate.`,
          relationshipId: r.id,
        });
      if (up.includes("OHS"))
        errors.push({
          rule: "generic-vs-custom-service",
          message: `Open Host Service (OHS) is not applicable in the customer-supplier relationship "${label(r)}"; OHS is one-size-fits-all.`,
          relationshipId: r.id,
        });
      if (down.includes("ACL"))
        warnings.push({
          rule: "protect-or-cooperate",
          message: `An ACL in the customer-supplier relationship "${label(r)}" may be unnecessary; the supplier should align with the customer.`,
          relationshipId: r.id,
        });
    }
  }

  return { errors, warnings };
}
