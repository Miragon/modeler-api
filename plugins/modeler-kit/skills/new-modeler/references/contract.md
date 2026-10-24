# The contract: `@miragon/modeler-api`

The contract is what every host binds: Design IQ's live sync, its MCP widgets, and both apps of the
modeler itself. Its laws, the kit and the versioning are documented in the
[package README](https://github.com/Miragon/modeler-suite/blob/main/packages/api/README.md) and as
JSDoc in [`src/index.ts`](https://github.com/Miragon/modeler-suite/blob/main/packages/api/src/index.ts);
this page is what they mean for a renderer, from the five that implement them.

## The factories

The renderer's entry exports two functions with these names, so hosts bind every notation the
same way (template: [`collaborative.ts`](../assets/template/packages/renderer/src/collaborative/collaborative.ts)):

- `createCollaborativeModeler(options)`: the editing mount, `meta.editable: true`;
- `createCollaborativeViewer(options)`: the read-only mount on the renderer's NavigatedViewer,
  `meta.editable: false`, never a change event, no command stack of its own needed.

Both take one options object that extends `CollaborativeModelerOptions` with the renderer's own
(`additionalModules` for the shell's `shellModule`), and return a `CollaborativeModeler` that
also exposes `diagram`, the wrapped diagram-js instance (`get`, `on`, `off`) for host wiring such
as menus and exports, `elements` with `bounds`, and, since 1.3, `contentBounds()`: the tight box of
everything the canvas draws, in diagram coordinates and `undefined` while nothing is drawn, which a
host fits to instead of reaching into the renderer's services. Compute it from the model, as the
template's [`ContentBounds.ts`](../assets/template/packages/renderer/src/io/ContentBounds.ts) does:
a box measured on the live SVG changes with the zoom wherever it holds text. The aligned options
since 1.2:

| Option         | The renderer does                                                                                                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `freeArea`     | places a keyboard-created element (Enter or Space on a palette entry) in the centre of `insets()` (px from the container's edges) or at `center()` (diagram coordinates); default: the visible centre |
| `fitOnImport`  | fits the content after every import, never above 100 %, unless `false` (the shell's viewport fits instead; both apps pass `false`)                                                                    |
| `undoRedoKeys` | binds Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z and Ctrl+Y to the canvas history unless `false` (VS Code owns the history)                                                                                         |

`meta` is `{ notation, apiVersion, editable }`: `notation` is the renderer's stable id (the template
uses the package slug; a host maps its own id to it), and `apiVersion` is `MODELER_API_VERSION`
imported from the pinned package, never a literal, so it follows every bump.

## What the laws mean for a renderer

| Law | Holds when …                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| L1  | an import renders outside the command stack, clears the history with `commandStack.clear(false)` (no event), and takes an open label editor down without committing (and reopens it on the same id)    |
| L2  | the serializer is deterministic and a fixpoint of its own parser; review the fixture bytes by hand, never paste what the build prints                                                                  |
| L3  | every document change is a command (titles, levels and axes too), the host listener sits on `commandStack.changed`, and `exportText()` reads the live canvas, so it is current inside the listener     |
| L4  | undo after an import finds an empty stack                                                                                                                                                              |
| L5  | `getViewState`/`setViewState` read and write `canvas.viewbox()`; a view change never commits the open label editor (it stays open and follows its element); an import fits unless `fitOnImport: false` |
| L6  | unknown lines and fields survive: a passthrough list in the model, zod `looseObject` for JSON notations, the import's business object written back on export                                           |
| L7  | the text is parsed and validated **before** the canvas is touched, so a rejection leaves nothing behind; the next import and the next command still work                                               |

Two rules hosts rely on beyond the table: blank text imports as an empty diagram (a new file, a
blank shared document), and calls before the first import never wedge the instance.

## Elements

`elements` makes the notation addressable: `list()`, `reveal(id)` (select and scroll, no change
event), `selection()`, `onSelection(callback)` and, since 1.2, `bounds(id)`: the live box in diagram
coordinates, `undefined` for an id `list()` does not report. Hosts anchor todos, deep links and
presence to these ids, so:

- an id is the element's id **in the text**: the serializer writes it, and an element created on
  the canvas gets one that survives a save and re-open;
- new ids are random or peer-scoped (`node_k3x9q2mf`), never a per-instance counter: two peers
  creating different elements at once must not collide (a RECOMMENDATION, the kit advises);
- only elements with a stable id are listed (Event Storming lists stickies, not its drawings);
- an external label reports as its element.

## The conformance kit

`registerConformance` from `@miragon/modeler-api/conformance` turns every law into a test case.
Run it in `npm run test:browser`: diagram-js needs a real layout engine, so mount into
`attachedHost()` under Vitest browser mode, never jsdom (template:
[`conformance.browser.test.ts`](../assets/template/packages/renderer/test/browser/conformance.browser.test.ts)).

- Fill **every** hook of `ConformanceHarness`: `create`, `createReadonly`, `canonicalTexts` (two
  distinct, reviewed), `looseTexts`, `invalidTexts` (`[]` only when nothing is non-importable),
  `foreignTexts` with `mustSurvive`, `probeTexts`, `viewState`, `mutate` (adds, with content that
  differs per call), `configMutations` (`[]` only without document settings), `undo`, `redo`,
  `moveElement`, `openInteraction` (types the same input every time), `interactionState`,
  `commitInteraction`, `settle`.
- Pass `onSkip` that throws: with every hook filled a skip is a gap, and a kit release that adds a
  case names the hook it needs. Collect `onAdvisory` and assert the list is empty after all cases (or throw in it):
  the renderer follows every recommendation, so an advisory is a regression.
- A case is only as good as the harness: drive real services (the renderer's label editor, the
  command stack, `modeling.moveElements`), not shortcuts around them.

## Versions and upgrades

The renderer pins `@miragon/modeler-api` exactly. Hosts check `apiVersionsCompatible` (same major)
at bind time and feature-detect optional surfaces (`typeof modeler.elements?.bounds === "function"`),
so a 1.x minor never breaks a host. Adopting a new minor: bump the pin, implement the new optional
surface or option, fill the kit's new hooks (its new cases report skips until then), and release it
as `feat` (or `fix(deps)` for a pin bump alone). A major changes a law; the README's "Candidates for
2.0" lists what is coming.
