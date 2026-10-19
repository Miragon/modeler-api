# CLAUDE.md

TypeScript modeler for the strategic Domain-Driven Design [Context Maps](https://contextmapper.org/)
notation (bounded contexts by subdomain type, connected by context-mapping relationship patterns with
OHS/PL/ACL/CF integration roles), built on [diagram-js](https://github.com/bpmn-io/diagram-js) (MIT).
Shared core for two targets: a web app and a VS Code extension.

## Design system (mandatory)

All UI/visual work MUST follow the Miragon product design system — this is not optional. Source of
truth: the **`miragon-brand:modeler-tool-design`** Claude skill (design system **1.13.0**; plugin
`miragon-brand` from [`Miragon/corporate-identity`](https://github.com/Miragon/corporate-identity));
install with `/plugin marketplace add Miragon/corporate-identity` +
`/plugin install miragon-brand@miragon`.

Its files are **vendored unchanged** in [`packages/renderer/src/theme/`](packages/renderer/src/theme):
`cd-tokens.generated.css`, `cd-tokens.generated.json` and `cd-canvas.css` — never edit them, re-copy
them from the skill's `assets/`. [`assets/context-maps.css`](packages/renderer/src/assets/context-maps.css)
loads them in the order of guide §10.3 (tokens in a cascade layer, then `diagram-js.css`, then
`cd-canvas.css`) and reads only the `--cd-ui-*` roles and the mode-independent tokens: no colour
literal, no fixed palette token. The pure-TS mirror
[`theme/palette.ts`](packages/renderer/src/theme/palette.ts) (`MIRAGON`) holds the values the SVG
drawing needs as attributes. Drift tests:
[`packages/renderer/test/theme.sync.test.ts`](packages/renderer/test/theme.sync.test.ts) pins the three
files to the release's hashes and checks the CSS rules, `MIRAGON` and the import order;
[`apps/vscode/test/tokens.sync.test.ts`](apps/vscode/test/tokens.sync.test.ts) pins the modeler
shell's `SHELL` sizes to the vendored `shell` tokens. The subdomain-type fills, relationship-pattern
strokes and integration-role marker colours in
[`packages/schema-model/src/notation.ts`](packages/schema-model/src/notation.ts) are the **official
Context Maps notation** and are serialized into documents — they stay as-is; the design system
applies to everything else (chrome, typography, selection, neutrals, the app icon).

## Contract and chrome

- **Contract.** The renderer implements the collaborative-modeler contract of
  [`@miragon/modeler-api`](https://www.npmjs.com/package/@miragon/modeler-api) (1.1):
  `createCollaborativeModeler` / `createCollaborativeViewer` in
  [`packages/renderer/src/collaborative/`](packages/renderer/src/collaborative), the text lane being
  the canonical JSON of a `.cm` file (`serializeDocumentText`, ends in one line break). Its
  conformance kit runs in `npm run test:browser`
  ([`conformance.browser.test.ts`](packages/renderer/test/browser/conformance.browser.test.ts)) with
  every hook filled; a skip or an advisory fails it. Imports are silent (the history goes without an
  event), reject without a trace (ids, coordinates, newer versions checked first) and keep unknown
  keys.
- **Chrome.** Both apps mount [`@miragon/modeler-shell`](https://www.npmjs.com/package/@miragon/modeler-shell)
  with `themes: ["light"]`: the VS Code webview on the `ide` host (menu, palette skin, zoom panel and
  keys, fit, legend slot, problems pill, status box, empty-file hint), the web app on the `web` host
  (the same plus File group, Share, legal line, toasts, problems list, start screen and drop zone;
  `index.html` gets the mode markup of `webHeadMarkup` from the Vite config). Neither app has a
  stylesheet or chrome markup of its own. The renderer **never imports the shell** (ESLint and
  dependency-cruiser enforce it); it hands the chrome structurally typed parts: `contextMapMenu`,
  `createShortcutsDialog`, `createTitleDialog`, `renderLegend`, the `cmReadOnly` canvas lock,
  keyboard creation (`freeRectInsets`) and `undoRedoKeys: false` for hosts that own the history.
  `cmLegendModule` and the renderer's own palette rules stay for hosts that embed the renderer
  without the shell. The DOM-free packages take only types from `@miragon/modeler-api`.
- **Kit.** `e2e/` runs the shell's conformance kit against the real webview in the shell's VS Code
  stub (project `vscode-webview`, served from `e2e/webview/`; only the inspector is absent) and
  against the web app (project `chromium`; the inspector and the invalid-file state are absent). Any
  skip fails the suite.

## Monorepo (npm workspaces)

Workspaces are declared in the root `package.json` (`workspaces` array, listed in topological build
order). **All** versions are pinned to exact values inline in each package's `package.json` (`.npmrc`
sets `save-exact=true`) — including internal `@miragon/context-maps-*` deps, which use the exact local
workspace version as found in the workspace's `package.json` (npm still links them to the local
workspace). Exact pinning is enforced in CI by the `pin-check` job.

Shared toolchain deps (`typescript`, `vitest`, `tsup`, `vite`, `playwright`) are pinned **once** in
the root `package.json` and hoisted to the workspaces — don't re-add them to workspace manifests.
`vite` is additionally listed in the root `overrides` so transitive copies (vitest, plugins) resolve
to the same version; keep the two entries identical. The vscode app pins its own `esbuild` (its
bundler), separate from tsup's `esbuild` pinned via `overrides` — intentional, don't unify; `e2e`
pins the same `esbuild` as the vscode app for its smoke test of the shipped webview bundle.

| Package                              | Purpose                                                                      | DOM |
| ------------------------------------ | ---------------------------------------------------------------------------- | --- |
| `@miragon/context-maps-schema-model` | Types, the notation spec, Zod validation, migrations, JSON serialization     | no  |
| `@miragon/context-maps-cml`          | Context Mapper CML ↔ document (parse and serialize)                          | no  |
| `@miragon/context-maps-renderer`     | diagram-js viewer/modeler, the collaborative-modeler contract, import/export | yes |
| `apps/webapp`                        | Vite demo editor on the modeler shell (web host)                             | yes |
| `apps/vscode`                        | VS Code extension: custom editors for `.cm`/`.cm.json` and `*.cm.png`        | yes |

**P1 — DOM boundary:** the DOM-free packages (`schema-model`, `cml`) must **never** import
`diagram-js`/DOM libraries (`tiny-svg`, `min-dom`) or use the DOM (`window`/`document`). Enforced
twice — ESLint (`no-restricted-imports`/`no-restricted-globals`) **and** `dependency-cruiser` — so a
violating import fails `npm run lint` and `npm run depcruise`.

## Commands

- `npm run build` — packages (schema-model, then renderer) · `npm run build:webapp` (then
  `npm run check:build -w apps/webapp`: mode markup and licence comment in the bundle) ·
  `npm run build:vscode`
- `npm run dev:webapp` (alias: `npm run dev`) serves the webapp via [Portless](https://portless.sh)
  at a stable per-worktree `http://<worktree>.context-maps-modeler.localhost:8080` URL (Portless-derived
  from the git worktree; config in [`apps/webapp/portless.json`](apps/webapp/portless.json)). The `dev`
  script sets `PORTLESS_HTTPS=0 PORTLESS_PORT=8080`, so Portless runs plain HTTP on the non-privileged
  port 8080 and auto-starts — no `sudo`/`service install` (needs Node ≥ 24.15; see
  [`CONTRIBUTING.md`](CONTRIBUTING.md)). `npm run dev:webapp:plain` for plain Vite on `:5181`. ·
  `npm run dev:vscode`
- `npm test` — Vitest (unit; includes the VS Code host against a `vscode` mock) ·
  `npm run test:browser` — renderer and the contract kit in Chromium · `npm run test:e2e` —
  Playwright: the web app (`chromium`, `webkit`, port `E2E_PORT`, default 5180) and the VS Code
  webview (`vscode-webview`, port `E2E_WEBVIEW_PORT`, default 5190)
- `npm run notices -w apps/vscode` — regenerate `apps/vscode/THIRD_PARTY_NOTICES.md` (a unit test
  fails when it is stale)
- `npm run typecheck` · `npm run lint` (ESLint + typecheck)
- `npm run format` — Prettier · `npm run depcruise` — check the module graph

Requirements: Node ≥ 24.15, npm. The packages are consumed from **source** (Vite/esbuild/tsconfig
aliases), so neither the apps nor the tests need a prior package build; `npm run build` is for
publishing the libraries. The Husky pre-commit hook runs **only** lint-staged + `npm run lint`
(ESLint + type-check) — **not** tests/build/depcruise; run `npm test` yourself before pushing.

## Git

Everything is managed via **Conventional Commits** — primarily `feat`, `fix`, `refactor`, `chore`,
`docs`. Example: `feat(renderer): add a context-pad colour picker`.

## Conventions

- Keep the core package (`schema-model`) strictly DOM-free (P1, above).
- JSON serialization must stay deterministic (sorted, rounded, version-stamped) so diffs and share
  URLs stay stable.
- Pin **all** dependencies to exact versions — no version ranges (`^`/`~`/`>=`/`*`), internal
  workspace deps included (use the current local workspace version). See
  [`.claude/rules/package-json-fixed-versions.md`](.claude/rules/package-json-fixed-versions.md).
- Contributor onboarding in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Code Style

- Write comments only when explicitly requested. Otherwise write self-explanatory code — descriptive
  function and parameter names, no abbreviations.
- If comments are needed: make them **WHY**-driven, not **HOW**.
