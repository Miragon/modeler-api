# Changelog

## [0.2.0](https://github.com/Miragon/context-maps-modeler/compare/vscode-v0.1.0...vscode-v0.2.0) (2026-06-22)


### Features

* setup vs-code plugin ([#2](https://github.com/Miragon/context-maps-modeler/issues/2)) ([91f8103](https://github.com/Miragon/context-maps-modeler/commit/91f81036b9079ddab129db0c92a548ca167e8a94))


### Bug Fixes

* **deps:** clear all npm audit advisories + Miragon favicon ([#21](https://github.com/Miragon/context-maps-modeler/issues/21)) ([bf1d090](https://github.com/Miragon/context-maps-modeler/commit/bf1d090074201de690aa924a6f75b72b09f8306c))
* **deps:** clear all npm audit advisories + Miragon favicon ([#21](https://github.com/Miragon/context-maps-modeler/issues/21)) ([7095661](https://github.com/Miragon/context-maps-modeler/commit/70956619aa2e157d76bdbf591b97db56b6000ee5))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @miragon/context-maps-renderer bumped from 0.1.0 to 0.2.0
    * @miragon/context-maps-schema-model bumped from 0.1.0 to 0.2.0

## 0.1.0 — Unreleased

Initial VS Code extension.

- Custom text editor for `.tt` / `.ttm.json` (native JSON document) with the diagram-js Team
  Topologies `Modeler`.
- Two-way sync between the text document and the graphical canvas (echo-guarded).
- Collapsed menu (top-right): fit-to-view · export SVG/PNG. Undo/redo is left to VS Code /
  `Ctrl/Cmd+Z` (no buttons).
- SVG/PNG export with the scene embedded for round-trip reopening.
- **Editable embedded-PNG diagrams** (`*.tt.png` / `*.ttm.png`): a binary custom editor opens these
  files directly, reads the Context Maps diagram from the embedded `tEXt` chunk, and on save
  re-renders the PNG with the updated diagram embedded again — the file stays a normal, shareable
  PNG.
- Commands: **New Empty Diagram**, **New Diagram from Example**, **New Empty Diagram (embedded
  PNG)**.
