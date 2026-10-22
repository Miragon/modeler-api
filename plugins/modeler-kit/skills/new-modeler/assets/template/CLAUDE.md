# CLAUDE.md

TypeScript library for viewing and editing __DISPLAY_NAME__ diagrams, built on
[diagram-js](https://github.com/bpmn-io/diagram-js) (MIT): a web app and a VS Code extension on one
renderer. The plain-text `.__EXT__` file is the source of truth.

## Monorepo (npm workspaces)

| Package                              | Purpose                                               | DOM |
| ------------------------------------ | ----------------------------------------------------- | --- |
| `@miragon/__NOTATION__-schema-model` | data model, zod validation, the empty document        | no  |
| `@miragon/__NOTATION__-dsl`          | `.__EXT__` text ↔ model (lossless round trip)         | no  |
| `@miragon/__NOTATION__-renderer`     | diagram-js viewer and modeler, the contract factories | yes |
| `apps/webapp`                        | web app on `@miragon/modeler-shell` (`web` host)      | yes |
| `apps/vscode`                        | VS Code custom editor (`ide` host)                    | yes |
| `e2e`                                | Playwright, both hosts                                | yes |

**P1, the DOM boundary:** `schema-model` and `dsl` never import `diagram-js`, `tiny-svg`, `min-dom`
or use `window`/`document`, and take only types from `@miragon/modeler-api`. No package under
`packages/` imports `@miragon/modeler-shell`; only the apps and `e2e` mount it. Enforced twice:
ESLint (`npm run lint`) and dependency-cruiser (`npm run depcruise`).

## Commands

- `npm run build` (packages) · `npm run build:webapp` (then `npm run check:build -w apps/webapp`) ·
  `npm run build:vscode`
- `npm test` · `npm run test:browser` (the `@miragon/modeler-api` conformance kit) ·
  `npm run test:e2e` (the `@miragon/modeler-shell` conformance kit on the `web` and `ide` hosts;
  ports `E2E_PORT`, `E2E_WEBVIEW_PORT`)
- `npm run test:vscode-smoke`: the built extension in a real VS Code (`npm run build` and
  `npm run build:vscode` first; a window opens, on Linux run it under `xvfb-run -a`;
  `VSCODE_VERSION` picks the VS Code, default the newest stable release)
- `npm run lint` (ESLint + every tsconfig) · `npm run format` · `npm run depcruise`

Build the packages before the tests: workspace dependencies resolve to `dist`.

## Conventions

- Conventional Commits (`feat`, `fix`, `refactor`, `chore`, `docs`, …), signed; the PR title is the
  squash commit release-please reads.
- Exact pins everywhere, internal `@miragon/__NOTATION__-*` deps included; the only ranges are the
  consumer-shared peers (`zod`, `diagram-js`, `didi`, `tiny-svg`), each mirrored by an exact
  devDependency. See [`.claude/rules/package-json-fixed-versions.md`](.claude/rules/package-json-fixed-versions.md).
- The text round trip stays lossless: unknown lines survive (`passthrough`), the serializer is a
  fixpoint of its parser, element ids are written into the text.
- The renderer implements `@miragon/modeler-api` (`createCollaborativeModeler`,
  `createCollaborativeViewer`, notation `__NOTATION__`); every harness hook of the conformance
  kit is filled, so a skip or an advisory fails `npm run test:browser`.
- CI: `ci-ok` is the merge gate (required, with the PR title check). A new job in `ci.yml` goes
  into its `needs`. The VS Code smoke test runs in CI when a change touches `apps/vscode/`,
  `packages/`, a `package.json` or the lockfile, every week, and before each publish of the VSIX.
  See [`CONTRIBUTING.md`](CONTRIBUTING.md#ci).
- Comments only where they explain why.

## Design system (mandatory)

All UI follows the Miragon product design system, the `miragon-brand:modeler-tool-design` skill
(`/plugin marketplace add Miragon/corporate-identity`, `/plugin install miragon-brand@miragon`).
`cd-tokens.generated.css`, `cd-tokens.generated.json` and `cd-canvas.css` are vendored unchanged
into `packages/renderer/src/theme/`; re-copy them to update, never edit them. The chrome is
`@miragon/modeler-shell` in both apps; the renderer's stylesheet reads only `--cd-ui-*` roles.
