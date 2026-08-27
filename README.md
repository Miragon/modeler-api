# @miragon/modeler-api

ONE interface every Miragon modeler implements — the collaborative-modeler
contract and its conformance test kit.

## Why

Embedding a modeler in a collaborative host (a shared Y.Text, re-imports on
every remote change) exposes behavioral details that are invisible in
standalone use. Before this contract existed, each drift had to be discovered
per modeler, against its engine internals:

- an `importDSL` that ran `commandStack.clear()` **emitting** a change event —
  unsuppressed, opening a hand-authored file re-exported the canonical
  serialization over it;
- an import that left the undo stack on stale, removed shapes — undo after a
  co-editor's change silently no-op'd or deleted re-imported shapes by id
  coincidence;
- a serializer that was not a byte fixpoint of its own parser.

This package turns those lessons into **laws** (see the JSDoc on
`CollaborativeModeler`) and ships a **conformance kit** that makes every law
an executable test the modeler repo runs in its own CI. Drift fails the
modeler's build — not a downstream integration review.

## The contract (v1)

```ts
import type { CollaborativeModeler } from "@miragon/modeler-api";
```

| Law | Requirement                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------ |
| L1  | `importText` is **silent**: no change events, undo history erased without emitting                     |
| L2  | `exportText` is **canonical**: deterministic, a byte fixpoint on canonical input, idempotent otherwise |
| L3  | `onContentChanged` fires for **every** user-visible change (config edits included) — and nothing else  |
| L4  | undo directly after an import is a defined **no-op** — never a stale-history mutation                  |
| L5  | view state (`getViewState`/`setViewState`) survives a re-import                                        |
| L6  | `exportText` is total after a successful import — foreign content is preserved, never a throw          |
| L7  | a REJECTED import leaves no trace: previous document still rendered and exported, no events, no undo   |

View state is never part of the document: `setViewState` fires no change
events and `exportText` is independent of it.

Optional `elements` surface (stable ids, `reveal`, selection events) powers
host features like presence outlines, anchored todos and element deep links.

## The conformance kit

```ts
// e.g. test/conformance.test.ts in a modeler repo (any (name, fn) runner)
import { registerConformance } from "@miragon/modeler-api/conformance";
import { test } from "vitest";

registerConformance(
  {
    create: async () => mountMyModeler(document.createElement("div")),
    canonicalTexts: [CANONICAL_SAMPLE_A, CANONICAL_SAMPLE_B], // two DISTINCT ones — the undo law needs them
    looseTexts: [HAND_AUTHORED_SAMPLE],
    invalidTexts: [HALF_TYPED_SAMPLE],
    foreignTexts: [SAMPLE_WITH_VENDOR_EXTENSIONS],
    mutate: (m) => driveOneUserCommand(m),
    undo: (m) => triggerUndo(m),
    // engines that debounce change delivery: make this outlast the debounce
    settle: () => new Promise((r) => setTimeout(r, 50)),
  },
  test,
);
```

The kit throws plain `Error`s — no assertion-library or runner dependency.
Its own CI proves it bites: a conforming reference modeler passes every case,
and one deliberately broken variant per historical drift fails exactly the
case that encodes the violated law.

## Versioning

One identity: `MODELER_API_VERSION` follows the npm package version (a test
pins the majors together). Modelers pin the package and put the constant into
`meta.apiVersion`; hosts match on the major. Additive surfaces (a structured
snapshot lane alongside the text lane, richer element info) are minors.

## License

MIT
