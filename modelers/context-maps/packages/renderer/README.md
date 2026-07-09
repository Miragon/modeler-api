# @miragon/context-maps-renderer

[![npm](https://img.shields.io/npm/v/@miragon/context-maps-renderer)](https://www.npmjs.com/package/@miragon/context-maps-renderer)
[![License: MIT](https://img.shields.io/github/license/Miragon/context-maps-modeler)](https://github.com/Miragon/context-maps-modeler/blob/main/LICENSE)

The **browser layer** of the [Context Maps Modeler](../../README.md): a framework-agnostic viewer
and full editor for strategic Domain-Driven Design [Context Maps](https://contextmapper.org/)
diagrams, built on [diagram-js](https://github.com/bpmn-io/diagram-js) (MIT).

It renders the canonical document from
[`@miragon/context-maps-schema-model`](../schema-model) and gives you palette, move, resize,
connect-by-relationship, context pad, inline label editing and undo/redo — with no UI framework
required. Mount it into any `<div>`; the web app (React) and the VS Code extension both wrap this
exact package.

## Install

```bash
npm install @miragon/context-maps-renderer @miragon/context-maps-schema-model
```

## Three entry points

| Class             | Use it for                                                                     |
| ----------------- | ------------------------------------------------------------------------------ |
| `Viewer`          | Read-only rendering, no interaction (thumbnails, static embeds).               |
| `NavigatedViewer` | Read-only + zoom (scroll), pan (drag) and selection.                           |
| `Modeler`         | The full editor: palette, move, resize, context pad, label editing, undo/redo. |

All three share a common base (`CmBaseViewer`) with the same import/export and lifecycle API.

## Quick start

```ts
import { Modeler } from "@miragon/context-maps-renderer";
import "@miragon/context-maps-renderer/assets/context-maps.css";
import { SAMPLE_DOCUMENT } from "@miragon/context-maps-schema-model";

const modeler = new Modeler({ container: document.querySelector("#canvas")! });

// Load a document (auto-fits the viewport)
const { warnings } = modeler.importDocument(SAMPLE_DOCUMENT);

// Read the live canvas back as the canonical model
const doc = modeler.exportDocument();

// Export a standalone, self-contained SVG
const { svg } = modeler.saveSVG();

// Undo / redo are driven by the command stack
modeler.undo();
modeler.redo();
```

> **The CSS is required.** Import `@miragon/context-maps-renderer/assets/context-maps.css`
> (it also pulls in `diagram-js`'s own stylesheet) — without it the palette, context pad and label
> editor are unstyled.

## API

### Constructor — `CmViewerOptions`

```ts
new Modeler({
  container?: HTMLElement,            // host element (a detached <div> if omitted)
  width?: number | string,           // canvas width  (default "100%")
  height?: number | string,          // canvas height (default "100%", or "600px" with no container)
  additionalModules?: ModuleDeclaration[], // extra diagram-js modules
});
```

### Shared methods (`Viewer` / `NavigatedViewer` / `Modeler`)

| Method                             | Returns                         | Purpose                                           |
| ---------------------------------- | ------------------------------- | ------------------------------------------------- |
| `importDocument(doc)`              | `{ warnings: ImportWarning[] }` | Replace canvas content and auto-fit.              |
| `exportDocument()`                 | `CmDocument`                    | Rebuild the canonical model from the live canvas. |
| `saveSVG()`                        | `{ svg: string }`               | Self-contained SVG snapshot (fitted viewBox).     |
| `setMeta(partial)` / `getMeta()`   | — / `RootBusinessObject`        | Read/write diagram-level metadata (e.g. `title`). |
| `attachTo(el)` / `detach()`        | `void`                          | Move the canvas in/out of the DOM (keeps state).  |
| `clear()` / `destroy()`            | `void`                          | Empty the canvas / tear it down.                  |
| `on(event, cb)` / `off(event, cb)` | `void`                          | Subscribe to diagram-js events.                   |
| `get<T>(name)`                     | `T`                             | Resolve a diagram-js service (advanced).          |

### Modeler-only

`undo()`, `redo()`, `canUndo()`, `canRedo()`.

### Helpers & types

- **Type guards:** `isCmElement`, `isCmContext`, `isCmRelationship`.
- **Runtime element types:** `CmContext`, `CmRelationship`, `CmElement`.
- **Palette icon generators:** `contextIconSvg(type)`, `relationshipIconSvg(pattern)` —
  WYSIWYG SVG glyphs matching what the canvas draws.
- **Other:** `CmViewerOptions`, `ImportWarning`, `RootBusinessObject`, `ROOT_ID`, `saveSVG`.

## How it's built

The package is a set of [didi](https://github.com/nikku/didi) modules layered on diagram-js. Each is
exported (e.g. `cmDrawModule`, `cmPaletteModule`, `cmModelingModule`) so you can compose your own
viewer via `additionalModules`:

| Module                 | Responsibility                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `cmModelModule`        | Element factory with notation defaults (`CmElementFactory`).                        |
| `cmDrawModule`         | Custom SVG rendering of contexts and relationships (`ContextMapsRenderer`).         |
| `ioModule`             | Document ↔ canvas bridge (`CmImporter`, `CmExporter`, `saveSVG`).                   |
| `cmModelingModule`     | High-level mutations — label, subdomain type, relationship pattern, roles, colours. |
| `cmRulesModule`        | Editing rules (what can move / resize / be created / connected).                    |
| `cmBehaviorsModule`    | Keeps the model **flat** — shapes never nest.                                       |
| `cmPaletteModule`      | The drag-to-create tool palette.                                                    |
| `cmContextPadModule`   | Per-element actions (rename, delete, connect).                                      |
| `cmLabelEditingModule` | Double-click inline label editing.                                                  |
| `cmKeyboardModule`     | Undo / redo / delete shortcuts.                                                     |
| `cmZOrderModule`       | Fixed stacking order (relationships behind, contexts on top).                       |

### Rendering

A custom `ContextMapsRenderer` (priority `1500`, beating diagram-js's default) draws each element
from the spec in [`@miragon/context-maps-schema-model`](../schema-model): bounded-context boxes
coloured by subdomain type (core / supporting / generic) with their glyphs; and relationships drawn
as lines styled per context-mapping pattern (partnership, shared kernel, customer-supplier,
upstream-downstream, separate ways), carrying the pattern abbreviation, U/D end markers and the
OHS/PL/ACL/CF integration-role badges. Labels are word-wrapped and centred. Per-element `fill`/`stroke`
overrides win over the spec defaults.

## Import / export

The package reads and writes the canonical `CmDocument` (JSON) and exports a standalone **SVG**.
PNG export and the embedded-scene round-trip (storing the document inside the exported image) live in
the [web app](../../apps/webapp) and the [VS Code extension](../../apps/vscode), which add the canvas
rasterisation those formats need.

## Development

Part of the [Context Maps Modeler](../../README.md) monorepo; consumed from source by the apps.
From the repo root:

```bash
npm run build -w packages/renderer   # Vite library build → dist/ (publish build)
npm test                             # Vitest unit tests
npm run test:browser                 # renderer integration tests in real Chromium
npm run typecheck
```

## License

[MIT](../../LICENSE). diagram-js and its dependencies are MIT / ISC / Apache-2.0.
