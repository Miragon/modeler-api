# Context Maps for VS Code

[![VS Marketplace](https://img.shields.io/visual-studio-marketplace/v/miragon-gmbh.context-maps-modeler?label=VS%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=miragon-gmbh.context-maps-modeler)
[![License: MIT](https://img.shields.io/github/license/Miragon/context-maps-modeler)](https://github.com/Miragon/context-maps-modeler/blob/main/LICENSE)

[Context Maps](https://contextmapper.org/) are the strategic Domain-Driven Design view of a system:
bounded contexts, coloured by subdomain type (core / supporting / generic), connected by
context-mapping relationship patterns (partnership, shared kernel, customer-supplier,
upstream-downstream, separate ways). This extension lets you create and edit those diagrams directly
inside VS Code: it opens `.tt` / `.ttm.json` files (a Context Maps diagram stored as plain,
deterministic JSON) in a graphical editor, while the text file stays the source of truth, so save,
Git, and diff keep working.

New to the method? Read up on strategic DDD context maps in Kaiser's _Architecture for Flow_ and
Vernon's _DDD Distilled_.

## Getting started

Install **Context Maps Modeler** (publisher `miragon-gmbh`) from the VS Code Marketplace, then
start from a filled-in example context map or a blank diagram. The built-in **Get Started with Context
Maps Modeler** walkthrough is the recommended first stop — open it from the Command Palette with
**Welcome: Open Walkthrough…**, then click its **Create diagram from example** button and you have a
ready-made diagram to explore. From there you can open any `.tt` or `.ttm.json` file.

Prefer commands? Run these from the Command Palette (`Cmd/Ctrl+Shift+P`, type _"Context Maps"_):

- **Context Maps: New Diagram from Example** — pick a location, pre-filled with the example context map.
- **Context Maps: New Empty Diagram** — same, but a blank diagram (also under **File > New File…**).

## Reading a diagram

A diagram shows bounded contexts and the relationships between them.

- **Bounded contexts** are boxes coloured by **subdomain type**: **core** (star, warm
  red) — business-critical and differentiating; **supporting** (open hand, amber) — specialised but
  not differentiating; **generic** (dotted circle, blue) — a solved, off-the-shelf problem you buy
  rather than build.
- **Relationships** are lines styled per **context-mapping pattern**: **partnership** (P, thick
  indigo) and **shared kernel** (SK, thick green dashes) are symmetric; **customer-supplier** (C/S,
  orange dash-dot) and **upstream-downstream** (U/D, thin grey) are asymmetric with U/D end markers;
  **separate ways** (SW, fine dotted grey) means no integration.
- **Integration roles** decorate the ends of asymmetric relationships: upstream can be an **Open Host
  Service (OHS)** and/or a **Published Language (PL)**; downstream can apply an **Anticorruption Layer
  (ACL)** or be a **Conformist (CF)**.

## Editing a diagram

- **Custom editor for `.tt` / `.ttm.json`.** Open a diagram file and you get the full graphical
  editor, backed by the plain-text JSON file. Editing the text in a split view re-renders the canvas
  live (two-way sync), and VS Code tracks dirty state as you go. To reopen a diagram as raw text, use
  **View: Reopen Editor With…**, then pick **Text Editor**.
- **Full modeler:** the tool palette places the three subdomain types of bounded context and
  connects them with the context-mapping relationship patterns; the context pad on a selected
  element renames, connects or deletes it. Move, resize, and inline label editing all work, with
  undo/redo via `Ctrl/Cmd+Z` and `Ctrl/Cmd+Shift+Z`.
- **Collapsed menu** (top-right, Excalidraw-style): fit-to-view · export SVG/PNG.
- **Editable embedded-PNG diagrams (`*.tt.png` / `*.ttm.png`).** Exported PNGs store the diagram
  inside a `tEXt` chunk, so the file stays a normal image you can drop into a wiki, README, or chat —
  and can be reopened and edited graphically. To start one, run **Context Maps: New Empty Diagram
  (embedded PNG)** (also under **File > New File…**), pick a location, and press `Ctrl/Cmd+S` once to
  render the first PNG.
- **Offline-capable** — no CDN, no network.

## Development

Building from source and the dev loop are documented in
[CONTRIBUTING.md](https://github.com/Miragon/context-maps-modeler/blob/main/CONTRIBUTING.md).

## License

MIT
