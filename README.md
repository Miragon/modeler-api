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
- a serializer that was not a byte fixpoint of its own parser;
- config/axis edits that fired their own event instead of the command stack —
  a host observing only the stack lost them.

This package turns those lessons into **laws** (see the JSDoc on
`CollaborativeModeler`) and ships a **conformance kit** that makes every law
an executable test the modeler repo runs in its own CI. Drift fails the
modeler's build — not a downstream integration review.

## The contract (v1)

```ts
import type { CollaborativeModeler } from "@miragon/modeler-api";
```

| Law | Requirement                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | `importText` is **silent**: no change events, undo history erased without emitting — also over existing history and foreign content                                                                     |
| L2  | `exportText` is **canonical**: deterministic, a byte fixpoint on canonical input, idempotent otherwise                                                                                                  |
| L3  | `onContentChanged` fires for **every** user-visible change — element commands, config/axis/title edits, undo/redo — and nothing else; inside a listener `exportText()` already returns the new document |
| L4  | undo directly after an import is a defined **no-op** — never a stale-history mutation                                                                                                                   |
| L5  | view state survives a re-import; an import leaves the view **fitted** to the content; the readback may be a normalised form of what was set                                                             |
| L6  | `exportText` is total after a successful import; foreign content is **preserved** through import → export, never dropped, never a throw                                                                 |
| L7  | a REJECTED import leaves no trace — previous document still rendered and exported, no events, undo history untouched — and the modeler **stays usable**                                                 |

View state is never part of the document: `setViewState` fires no change
events and `exportText` is independent of it.

`meta.editable` tells a viewer mount from an editor: a package that ships a
`NavigatedViewer`/`Viewer` exposes it under the same contract with
`editable: false` — it imports, exports, reveals and reports view state like
the editor and never fires `onContentChanged`, so hosts mount it on read-only
surfaces without per-package knowledge.

Optional `elements` surface (stable ids, `reveal`, a synchronous `selection()`
and selection events) powers host features like anchored todos, `?element=`
deep links and the selection half of live presence. Ids are ELEMENT ids
(a label shape resolves to its target) and survive edits to other elements —
positional ids that renumber when a line is inserted above break every anchor
below.

## The conformance kit

```ts
// e.g. test/conformance.browser.test.ts in a modeler repo (any (name, fn) runner)
import { attachedHost, registerConformance } from "@miragon/modeler-api/conformance";
import { test } from "vitest";

registerConformance(
  {
    create: async () => mountMyModeler(attachedHost()), // IN the document, sized — see below
    createReadonly: async () => mountMyViewer(attachedHost()), // the viewer mount, if the package ships one
    canonicalTexts: [CANONICAL_SAMPLE_A, CANONICAL_SAMPLE_B], // two DISTINCT, REVIEWED ones — the undo law needs them
    looseTexts: [HAND_AUTHORED_SAMPLE],
    invalidTexts: [HALF_TYPED_SAMPLE], // [] if NOTHING is non-importable (a lenient line DSL)
    foreignTexts: [{ text: SAMPLE_WITH_VENDOR_EXTENSION, mustSurvive: ["x-vendor: keep-me"] }],
    viewState: { x: 120, y: 80, width: 640, height: 480 }, // a panned/zoomed viewport, not the fitted one (the kit compares readbacks, never this literal)
    mutate: (m) => addOneElement(m), // undoable; adds — never renames or deletes
    configMutations: [{ name: "axis labels", run: (m) => renameEvolutionAxis(m) }], // [] if the notation has none
    undo: (m) => triggerUndo(m),
    redo: (m) => triggerRedo(m),
    // engines that debounce change delivery: make this outlast the debounce
    settle: () => new Promise((r) => setTimeout(r, 50)),
  },
  test,
);
```

**Run it in a real browser.** diagram-js engines compute viewboxes from the
host's client size and use `getBBox`, which jsdom lacks and a detached or 0×0
element turns into NaN: mount into `attachedHost()` (a sized element appended
to `document.body`) under vitest browser mode / Playwright — the modeler
repos' `test:browser` project — not under the unit project.

**Canonical texts are yours to vouch for.** L2 proves `exportText` is a
fixpoint of the texts you provide. Obtain them by exporting a hand-authored
document and reviewing the bytes; pasting whatever the current build prints
proves only that it agrees with itself.

**Nothing skips silently.** A case whose harness field is `undefined` reports
a SKIP (`console.warn` by default, `registerConformance(h, test, { onSkip })`
to route it) instead of passing. An explicit `[]` (`invalidTexts`,
`foreignTexts`, `configMutations`, `looseTexts`) is a statement that the
notation has no such form and skips nothing.

**View state is compared by readback.** The kit never compares
`getViewState()` with your `viewState` literal: it sets it, reads the
modeler's own (possibly normalised) state back, and requires that readback
to survive a re-import — a diagram-js viewbox that comes back rounded with
`scale`/`inner`/`outer` is fine.

**Element identity is verified through names.** After an unrelated edit every
id must still exist and, where the notation has names, still name the same
element; a notation whose elements carry no names is verified for id
existence only.

The kit throws plain `Error`s — no assertion-library or runner dependency.
Its own CI proves it bites: a conforming reference modeler
([`test/reference-modeler.ts`](test/reference-modeler.ts) — also the model
for a harness) passes every case, and one deliberately broken variant per
historical drift AND per kit case fails exactly the case set that encodes
the violated law (not every individual assertion has a saboteur; every case
does).

## Versioning

One identity: `MODELER_API_VERSION` IS the npm package version — release-please
rewrites the constant on every release (`extra-files`) and a test pins it to
`package.json` exactly. Modelers pin the package and put the constant into
`meta.apiVersion`; hosts match on the major — and, while the contract is
0.x, on the minor too (`apiVersionsCompatible`): pre-1.0 minors may break
(`bump-minor-pre-major`). Additive surfaces (a structured snapshot lane
alongside the text lane, richer element info) are minors.

## License

MIT
