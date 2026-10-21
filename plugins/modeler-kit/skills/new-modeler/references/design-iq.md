# Design IQ

Design IQ embeds a renderer in two places, its web editor and the MCP-App widgets, through one
spec per notation and the contract alone: no per-notation special cases. Adding the notation to
Design IQ is a change in Design IQ (a spec with `id`, `pkg`, `canvasClassName`,
`contractNotation` and a lazy `load()`); the renderer is ready for it when the following holds.

- **The contract factories** (`createCollaborativeModeler`, `createCollaborativeViewer`) are
  exported from the renderer's entry and accept `CollaborativeModelerOptions`: Design IQ passes
  `{ freeArea: { insets }, fitOnImport: false }` where its chrome covers the canvas, and
  `undoRedoKeys: true`.
- **The notation id.** At bind time Design IQ checks `meta.notation` against the spec's
  `contractNotation` and `apiVersionsCompatible(meta.apiVersion, MODELER_API_VERSION)`. The
  contract id may differ from Design IQ's own id (`team-topologies` for `team-topology`), so pick it
  once and never change it.
- **Blank text** imports as an empty diagram, a rejected import keeps the last good canvas (L7),
  and view state survives a re-import (L5): the live sync re-imports every remote change.
- **The stylesheet is scoped by descendant.** Loaded into a single-page app that also hosts the
  bpmn-js and dmn-js editors, a renderer stylesheet would re-theme diagram-js classes globally, so
  Design IQ prefixes **every** rule with `.<canvasClassName> ` (selectors starting with `:root` stay
  global). The renderer's own root class must therefore sit inside the host element it is attached
  to, never on it (`attachTo(host)` appends the renderer's container), its dialogs and popovers
  live inside that host, and no rule may target `html`, `body` or the attach host itself. The
  package exports the sheet separately (`./assets/<notation>.css`), so a host loads it once.
- **Host wiring through `diagram`.** Design IQ reads the wrapped diagram structurally (`get`, `on`,
  `off`) for its menu (the renderer's menu content and shortcuts dialog, given a chrome with
  `root`, `messages` and `menu.trigger`), titles, content bounds for its own fit and a legend, so
  keep those builders in the renderer, typed structurally, never behind the shell.
- **Tokens in a layer** (see [design system](design-system.md#stylesheet-rules)), so Design IQ's own
  tokens win.
