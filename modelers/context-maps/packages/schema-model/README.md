# @miragon/context-maps-schema-model

[![npm](https://img.shields.io/npm/v/@miragon/context-maps-schema-model)](https://www.npmjs.com/package/@miragon/context-maps-schema-model)
[![License: MIT](https://img.shields.io/github/license/Miragon/context-maps-modeler)](https://github.com/Miragon/context-maps-modeler/blob/main/LICENSE)

The **DOM-free core** of the [Context Maps Modeler](../../README.md): the data model, the notation
specification, runtime validation, version migrations and deterministic JSON serialization for
strategic Domain-Driven Design [Context Maps](https://contextmapper.org/) diagrams.

This package has **no view, no DOM and no diagram-js** — it is plain TypeScript that runs anywhere
(browser, Node, an edge function, a CLI). The browser renderer
([`@miragon/context-maps-renderer`](../renderer)), the web app and the VS Code extension all build
on top of it. The DOM-freedom is enforced in CI (ESLint `no-restricted-imports` /
`no-restricted-globals` **and** `dependency-cruiser`), so a stray `diagram-js`/`window`/`document`
reference fails the build.

## Install

```bash
npm install @miragon/context-maps-schema-model
```

## What's inside

- **The notation spec** — the three subdomain types and five context-mapping relationship patterns,
  with their colours and stroke styles as plain data you can read and render against.
- **The document model** — a small, stable shape (`CmDocument`) with `version`, `title`, `contexts`
  and `relationships`.
- **Runtime validation** — Zod schemas + `parseDocument()` for structural checks, plus
  `validateDocument()` for the thirteen strategic-DDD semantic rules, for everything that comes from a
  file, a URL or `localStorage`.
- **Forward migrations** — `parseDocument()` migrates older documents up to the current version
  before validating, keyed by the document `version`.
- **Deterministic serialization** — sorted, rounded and version-stamped output, so `.cm.json` files
  diff cleanly and share URLs stay stable.
- **Factories & a sample** — helpers that create well-formed elements and documents, plus a complete
  example context map.

## The document format

A diagram is a single JSON object: a set of **bounded contexts** (boxes) and the **relationships**
(context-mapping patterns) that connect them via `from` → `to` context references.

```jsonc
{
  "version": 1,
  "title": "Conference event planner — context map",
  "contexts": [
    {
      "id": "ctx_cfp",
      "label": "CfP Management",
      "subdomainType": "core",
      "position": { "x": 340, "y": 120 },
      "size": { "width": 200, "height": 110 },
    },
  ],
  "relationships": [
    {
      "id": "rel_cfp_submission",
      "from": "ctx_cfp",
      "to": "ctx_submission",
      "pattern": "upstream-downstream",
      "upstreamRoles": ["OHS"],
      "downstreamRoles": ["ACL"],
    },
  ],
}
```

| Field           | Type               | Notes                                                                                                                             |
| --------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `version`       | `1`                | `DOCUMENT_VERSION`; older versions are migrated up on parse.                                                                      |
| `title`         | `string`           | Diagram name.                                                                                                                     |
| `contexts`      | `BoundedContext[]` | A box: `label`, `position`, `size`, optional `subdomainType`, `team`, `description`, `fill`, `stroke`.                            |
| `relationships` | `Relationship[]`   | An edge `from` → `to`: `pattern`, optional `upstreamRoles`/`downstreamRoles`, `label`, `description`, `implementationTechnology`. |

## Notation

The single source of truth for the visual notation. Bounded contexts are boxes coloured by subdomain
type; relationships are lines styled per context-mapping pattern. Every relationship is distinguished
by stroke **and** colour, so diagrams survive colour-vision deficiency and greyscale printing.

### Subdomain types — `SUBDOMAIN_TYPE_SPECS`

| `type`       | Label                | Icon          | Fill / Stroke         |
| ------------ | -------------------- | ------------- | --------------------- |
| `core`       | Core Domain          | star          | `#FDE0D5` / `#E8663D` |
| `supporting` | Supporting Subdomain | open hand     | `#FFF4CC` / `#E8B84B` |
| `generic`    | Generic Subdomain    | dotted circle | `#DCE9F5` / `#5B8DC7` |

### Relationship patterns — `RELATIONSHIP_PATTERN_SPECS`

| `pattern`             | Label               | Abbr. | Stroke                  | Symmetry   |
| --------------------- | ------------------- | ----- | ----------------------- | ---------- |
| `partnership`         | Partnership         | P     | indigo, thick solid     | symmetric  |
| `shared-kernel`       | Shared Kernel       | SK    | green, thick long-dash  | symmetric  |
| `customer-supplier`   | Customer-Supplier   | C/S   | orange, dash-dot        | asymmetric |
| `upstream-downstream` | Upstream-Downstream | U/D   | grey, thin solid        | asymmetric |
| `separate-ways`       | Separate Ways       | SW    | light grey, fine dotted | symmetric  |

The **integration roles** that decorate the ends of asymmetric relationships come from
`UPSTREAM_ROLE_SPECS` (OHS = Open Host Service, PL = Published Language) and `DOWNSTREAM_ROLE_SPECS`
(ACL = Anticorruption Layer, CF = Conformist), with per-marker colours in `MARK_COLORS`.

## Usage

```ts
import {
  emptyDocument,
  createBoundedContext,
  createRelationship,
  serializeDocument,
  parseDocument,
  SAMPLE_DOCUMENT,
} from "@miragon/context-maps-schema-model";

// Build a document with the factories (notation defaults applied automatically)
const doc = emptyDocument("Conference event planner");
const cfp = createBoundedContext("core", { x: 340, y: 120 }, { label: "CfP Management" });
const submission = createBoundedContext(
  "core",
  { x: 640, y: 300 },
  { label: "Submission Handling" },
);
doc.contexts.push(cfp, submission);
doc.relationships.push(
  createRelationship(cfp.id, submission.id, "upstream-downstream", {
    upstreamRoles: ["OHS"],
    downstreamRoles: ["ACL"],
  }),
);

// Serialize deterministically (sorted, rounded, version-stamped) — diff- and URL-stable
const json = serializeDocument(doc);

// Validate + migrate anything untrusted (file / URL / localStorage)
const result = parseDocument(JSON.parse(json));
if (result.ok) {
  console.log(result.document.title);
} else {
  console.error(result.error);
}

// A ready-made example context map
console.log(SAMPLE_DOCUMENT.title);
```

### API surface

| Export                                                                                        | Purpose                                                              |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `CmDocument`, `BoundedContext`, `Relationship`, `Position`, `Size`                            | The document model types.                                            |
| `SubdomainType`, `RelationshipPattern`, `UpstreamRole`, `DownstreamRole`, + their value lists | The notation's discriminator unions + their value lists.             |
| `SUBDOMAIN_TYPE_SPECS`, `RELATIONSHIP_PATTERN_SPECS`, `MARK_COLORS`, `dashArray()`            | The visual notation spec (colours, strokes, markers) as data.        |
| `documentSchema`, `boundedContextSchema`, `relationshipSchema`                                | Zod schemas for each shape.                                          |
| `parseDocument()`, `ParseResult`, `validateDocument()`, `ValidationReport`                    | Structural parse + the thirteen strategic-DDD semantic rules.        |
| `serializeDocument()`, `canonicalize()`                                                       | Deterministic JSON serialization (sorted, rounded, fixed key order). |
| `emptyDocument()`, `createBoundedContext()`, `createRelationship()`, `newId()`                | Factories with notation defaults + id generation.                    |
| `SAMPLE_DOCUMENT`                                                                             | A complete example context map.                                      |
| `DOCUMENT_VERSION`                                                                            | The current document version (`1`).                                  |

## Determinism & migrations

- **Determinism** — `serializeDocument()` runs `canonicalize()` first: arrays are sorted by `id`,
  coordinates are rounded to two decimals, optional fields with no value are dropped, and keys are
  written in a fixed order. The same logical diagram always produces byte-identical JSON, which is
  what makes Git diffs small and share URLs stable.
- **Migrations** — `parseDocument()` normalises older/foreign documents before validating (keyed by
  `version`). `1` is the first version, so this mainly coerces loosely-shaped input (e.g. a
  hand-written file) into the expected `{ contexts, relationships }` container.

## Development

This package is part of the [Context Maps Modeler](../../README.md) monorepo and is normally
consumed from source. From the repo root:

```bash
npm run build -w packages/schema-model   # tsup → dist/ (publish build)
npm test                                 # Vitest unit tests
npm run typecheck                        # tsc, compiled WITHOUT the DOM lib
```

## License

[MIT](../../LICENSE).
