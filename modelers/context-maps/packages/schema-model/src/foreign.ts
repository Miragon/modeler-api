/**
 * Keys a document, a context or a relationship may carry that this version of the model does not
 * know — a vendor extension, a field of a newer modeler. They are kept as they are and written back
 * after the known keys, so opening and saving a file never drops content (L6 of the
 * collaborative-modeler contract).
 */

/** The keys of a document this version understands. */
export const DOCUMENT_KEYS = ["version", "title", "contexts", "relationships"] as const;

/** The keys of a bounded context this version understands. */
export const CONTEXT_KEYS = [
  "id",
  "label",
  "subdomainType",
  "team",
  "description",
  "position",
  "size",
  "fill",
  "stroke",
] as const;

/** The keys of a relationship this version understands. */
export const RELATIONSHIP_KEYS = [
  "id",
  "from",
  "to",
  "pattern",
  "upstreamRoles",
  "downstreamRoles",
  "label",
  "description",
  "implementationTechnology",
] as const;

/**
 * The fields of `source` whose keys are not in `knownKeys`, in their own order; fields holding
 * `undefined` do not count. `Object.fromEntries` defines every key as an own property, so even a
 * key named `__proto__` stays a field instead of replacing the prototype.
 */
export function foreignFields(
  source: object,
  knownKeys: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(source).filter(
      ([key, value]) => !knownKeys.includes(key) && value !== undefined,
    ),
  );
}

/** `known` followed by the foreign fields of `source`, sorted by key (the canonical order). */
export function withForeignFields<T extends object>(
  known: T,
  source: object,
  knownKeys: readonly string[],
): T {
  const foreign = Object.entries(foreignFields(source, knownKeys)).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  if (foreign.length === 0) return known;
  return Object.fromEntries([...Object.entries(known), ...foreign]) as T;
}
