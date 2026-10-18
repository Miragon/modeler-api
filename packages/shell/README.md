# @miragon/modeler-shell

The shared, framework-free chrome around Miragon diagram-js modelers: menu button with dropdown,
horizontal palette skin, chrome tooltip, zoom panel with keys and fit, problems pill, status box,
empty-file hint, legend and inspector slots, and the plumbing to VS Code webviews. Look and behaviour
follow the Miragon design system (guide §5, §13.3 to §13.5); the mechanics are in the
[implementation notes](../../docs/shell/implementation-notes.md).

**Status: 0.1 in development** ([#4](https://github.com/Miragon/modeler-api/issues/4), Phase 4).
The public API is fixed in [API.md](API.md); the sources are stubs until the modules land.

- Zero runtime dependencies; diagram-js services are typed structurally, the `vscode` namespace and
  Playwright are passed in.
- Styles read only the design-system roles (`--cd-ui-*`) and shell sizes (`--cd-shell-*`) the
  modeler vendors with `cd-tokens.generated.css`.
- English UI texts by default, all overridable through one messages table.

```sh
npm i @miragon/modeler-shell
```

See [API.md](API.md) for the entry points and a complete VS Code example (Event Storming).

## Development

Run from the repository root (`-w packages/shell` for this package only):

```sh
npm run build -w packages/shell       # tsup: ESM + CJS + d.ts, dist/shell.css
npm run typecheck -w packages/shell   # src, core without DOM lib, demo
npm test -w packages/shell            # Vitest: node (core, boundaries) and happy-dom projects
npx playwright install chromium       # once
npm run test:e2e -w packages/shell    # Playwright: the conformance kit against demo/
npm run demo -w packages/shell        # the demo page on http://localhost:5181
```

| Directory                   | Module                                                             |
| --------------------------- | ------------------------------------------------------------------ |
| `src/core`                  | DOM-free: fit math, keymap, zoom readout, appearance, sizes, texts |
| `src/dom`                   | `mountShell`: menu, zoom panel, tooltip, pill, status, slots, keys |
| `src/diagram-js`            | `shellModule`, viewport, `connectDiagramJs`, palette skin          |
| `src/vscode`                | extension side (HTML, theme bridge) and webview side               |
| `src/testing`               | the Playwright-driven conformance kit                              |
| `src/*.ts`, `src/shell.css` | the entry points                                                   |
| `demo/`, `e2e/`             | the demo modeler and the e2e suite running the kit against it      |
| `fixtures/tokens`           | the token files, vendored unchanged for tests and the demo         |

A module imports another one only through its `index.ts`; `src/core` imports nothing outside
itself and compiles without the DOM library. `test/package-boundaries.test.ts` enforces this, the
zero runtime dependencies and the token-only stylesheets.

## License

MIT. The inlined Lucide icons are ISC, see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
