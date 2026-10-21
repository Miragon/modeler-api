# __DISPLAY_NAME__ Modeler

View and edit __DISPLAY_NAME__ diagrams as plain-text `.__EXT__` files: a web app and a VS Code
extension on one diagram-js renderer, part of the Miragon modeler family.

| Package                                                       | Purpose                                                               |
| ------------------------------------------------------------- | --------------------------------------------------------------------- |
| [`@miragon/__NOTATION__-schema-model`](packages/schema-model) | the data model, validation, the empty document (DOM-free)             |
| [`@miragon/__NOTATION__-dsl`](packages/dsl)                   | `.__EXT__` text ↔ model, lossless round trip (DOM-free)               |
| [`@miragon/__NOTATION__-renderer`](packages/renderer)         | viewer and modeler on diagram-js, implementing `@miragon/modeler-api` |
| [`apps/webapp`](apps/webapp)                                  | the web app, on `@miragon/modeler-shell`                              |
| [`apps/vscode`](apps/vscode)                                  | the VS Code custom editor for `.__EXT__`                              |

## Development

```sh
npm ci
npm run build          # the packages (the tests resolve them from dist)
npm test               # unit tests
npm run test:browser   # the renderer in Chromium, with the modeler-api conformance kit
npm run test:e2e       # Playwright: web app and VS Code webview, with the shell conformance kit
npm run lint           # ESLint and every tsconfig
npm run dev:webapp     # the web app
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for commits, releases and the checks CI runs.

## License

MIT
