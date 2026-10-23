# CLAUDE.md

TypeScript modeler for the strategic Domain-Driven Design [Context Maps](https://contextmapper.org/)
notation (bounded contexts by subdomain type, connected by context-mapping relationship patterns with
OHS/PL/ACL/CF integration roles), built on [diagram-js](https://github.com/bpmn-io/diagram-js) (MIT).
Shared core for two targets: a web app and a VS Code extension.

## Design system (mandatory)

All UI/visual work MUST follow the Miragon product design system — this is not optional. Source of
truth: the **`miragon-brand:modeler-tool-design`** Claude skill (design system **1.15.0**; plugin
`miragon-brand` from [`Miragon/corporate-identity`](https://github.com/Miragon/corporate-identity));
install with `/plugin marketplace add Miragon/corporate-identity` +
`/plugin install miragon-brand@miragon`.

Its files are **vendored unchanged** in [`packages/renderer/src/theme/`](packages/renderer/src/theme):
`cd-tokens.generated.css`, `cd-tokens.generated.json` and `cd-canvas.css` (the same bytes from
1.13.0 to 1.15.0) — never edit them, re-copy them from the skill's `assets/`. [`assets/context-maps.css`](packages/renderer/src/assets/context-maps.css)
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
  [`@miragon/modeler-api`](https://www.npmjs.com/package/@miragon/modeler-api) (1.3):
  `createCollaborativeModeler` / `createCollaborativeViewer` in
  [`packages/renderer/src/collaborative/`](packages/renderer/src/collaborative), the text lane being
  the canonical JSON of a `.cm` file (`serializeDocumentText`, ends in one line break). Its
  conformance kit runs in `npm run test:browser`
  ([`conformance.browser.test.ts`](packages/renderer/test/browser/conformance.browser.test.ts)) with
  every hook filled; a skip or an advisory fails it. Imports are silent (the history goes without an
  event), reject without a trace (ids, coordinates, newer versions checked first) and keep unknown
  keys. A host's view change (`setViewState`, a fit) never commits an open editor,
  `elements.bounds(id)` gives an element's live box and `contentBounds()` (also on every
  `CmBaseViewer`) the tight box around what the canvas draws: the contexts, wider where a team row
  or a type's name runs past one (`draw/contextLayout.ts` holds the geometry for the renderer and
  the box), and the relationships' waypoints, read from the model with text measured on a canvas,
  not from the SVG. The fit after an import centres it with the insets of `freeArea: { insets }` or
  with room for the renderer's own palette (also when only `{ center }` is given; a test pins
  both), and a browser test compares the box with the drawing at zoom 1.
- **Chrome.** Both apps mount [`@miragon/modeler-shell`](https://www.npmjs.com/package/@miragon/modeler-shell)
  with `themes: ["light"]`: the VS Code webview on the `ide` host (menu, palette skin, zoom panel and
  keys, fit, legend slot, problems pill, status box, empty-file hint), the web app on the `web` host
  (the same plus File group, Share, legal line, toasts, problems list, start screen and drop zone;
  `index.html` gets the mode markup of `webHeadMarkup` from the Vite config). Neither app has a
  stylesheet or chrome markup of its own. `connectDiagramJs(shell, …, { modeler, isEmpty })` fits
  to the renderer's `contentBounds()`: the webview passes its contract instance, the web app its
  `Modeler`; neither computes bounds of its own. The renderer **never imports the shell** (ESLint
  and dependency-cruiser enforce it); it hands the chrome structurally typed parts: `contextMapMenu`,
  `createShortcutsDialog`, `createTitleDialog`, `renderLegend`, the `cmReadOnly` canvas lock,
  keyboard creation in the free area (`freeArea: { insets }`; `freeRectInsets` stays a deprecated
  alias through the 0.5 releases), `fitOnImport` and `undoRedoKeys: false` for hosts that own the
  history. `cmLegendModule` (closed at first on every canvas size; a host's `setOpen()` restores a
  stored state) and the renderer's own palette rules stay for hosts that embed the renderer without
  the shell. The DOM-free packages take only types from `@miragon/modeler-api`.
- **Kit.** `e2e/` runs the shell's conformance kit against the real webview in the shell's VS Code
  stub (project `vscode-webview`, served from `e2e/webview/`; the inspector and `canvasMenuAction`
  are absent: VS Code's own File menu opens and saves, and the Model group holds only the "Map
  title…" dialog and the Legend checkbox) and against the web app (project `chromium`; the
  inspector and the invalid-file state are absent). Both feed the `labelEditor` hooks
  ([`e2e/tests/support/label-editor.ts`](e2e/tests/support/label-editor.ts): a double-click on a
  context, typed text; a commit shows as a changed map in the web app and as an `edit` message in
  the webview). Both suites register the cases themselves (`shellConformanceCases()`): every case
  opens the example, the `labelEditor` case `COMPACT_MAP`, which fits at 100 % in the kit's wide
  size. The example fits at 68 % there, where that case's zoom in lands on 100 % and its Cmd/Ctrl+0
  step cannot change the view (modeler-shell 0.4.0). Any skip fails the suite.
- **Real VS Code.** `npm run test:vscode` (Vitest project `vscode`, in
  [`apps/vscode/test-smoke/`](apps/vscode/test-smoke)) packs the extension as the release does
  (`vsce package --no-dependencies`), unpacks the VSIX outside the repository and runs the shell's
  `runVsCodeSmoke` on it: open, the default palette edit, save (`parseDocumentText`, one more
  context, canonical text), undo and VS Code's four default themes, screenshots in
  `test-results/vscode-smoke/`. No retry: the driver (since 0.3.2) reads the save only once the
  tab is clean and the file holds still, so a failed save check is the extension's, not a race; the
  driver's failures are a soft assertion, so another step's failure cannot hide the save's. A
  theme switch VS Code missed is retried by the driver (since 0.4.1: the setting written again,
  then a detour through another theme), so the test needs no retry of its own. Opt-in
  (needs a display, downloads VS Code once). CI runs it under `xvfb-run -a` in the reusable
  `vscode-smoke.yml`: `ci.yml` calls it as the job `vscode-smoke` (part of the `ci-ok` gate; it runs
  only when a path the extension or the test depends on changed), `vscode-smoke-weekly.yml` every
  Monday (a failure opens a tracking issue), and the release smokes the very VSIX it publishes
  (`VSCODE_SMOKE_VSIX`); screenshots as the `vscode-smoke-<stable|minimum>` artifacts, logs of a
  failed run as `vscode-smoke-logs-<stable|minimum>`. Locally run `npm run test:vscode:docker` (the
  shell's `modeler-shell-vscode-docker`: the same test in a Linux container, no window, no focus
  taken; `-- --env VSCODE_SMOKE_KEEP=1` brings VS Code's logs back into
  `test-results/vscode-smoke/vscode-logs/`); `npm run test:vscode` opens a real VS Code window on
  macOS.

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
pins the same `esbuild` as the vscode app for its smoke test of the shipped webview bundle. The
vscode app also pins `playwright-core` and `@vscode/test-electron`, the optional peers of the shell's
VS Code smoke driver; keep `playwright-core` equal to the root `playwright`.

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
  webview (`vscode-webview`, port `E2E_WEBVIEW_PORT`, default 5190) · `npm run test:vscode:docker`
  — the packaged extension in a real VS Code inside Docker, without a window (the local way;
  `-- --env VSCODE_VERSION=1.96.0` picks the version) · `npm run test:vscode` — the same on the
  host, for CI (Linux under `xvfb-run -a`) and for a visible window on macOS (`VSCODE_VERSION`
  picks the version; see [`CONTRIBUTING.md`](CONTRIBUTING.md))
- `npm run notices -w apps/vscode` — regenerate `apps/vscode/THIRD_PARTY_NOTICES.md` (a unit test
  fails when it is stale)
- `npm run typecheck` · `npm run lint` (ESLint + typecheck)
- `npm run format` — Prettier · `npm run depcruise` — check the module graph

Requirements: Node ≥ 24.15, npm. The packages are consumed from **source** (Vite/esbuild/tsconfig
aliases), so neither the apps nor the tests need a prior package build; `npm run build` is for
publishing the libraries. The Husky pre-commit hook runs **only** lint-staged + `npm run lint`
(ESLint + type-check) — **not** tests/build/depcruise; run `npm test` yourself before pushing.

**CI:** the job `ci-ok` in [`ci.yml`](.github/workflows/ci.yml) is the merge gate. It needs every
other job of `ci.yml` and fails when one of them failed, was cancelled or was skipped (only
`dependency-review` may skip, outside pull requests), so a **new job in `ci.yml` goes into `ci-ok`'s
`needs`**. `ci-ok` and the PR title check `validate-pr-title` are the checks for the `main` ruleset
to require, not the single jobs. See [`CONTRIBUTING.md`](CONTRIBUTING.md#ci-and-the-merge-gate).

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
  The exception is `peerDependencies`: the libraries a host shares (`zod`, `diagram-js`, `didi`,
  `tiny-svg`) are caret-ranged peers, mirrored by exact devDependencies and pinned exactly by the
  apps. [`peer-dependencies.test.ts`](packages/renderer/test/peer-dependencies.test.ts) checks that
  every range admits its devDependency, the apps' pins and what the other peers require.
- Contributor onboarding in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Code Style

- Write comments only when explicitly requested. Otherwise write self-explanatory code — descriptive
  function and parameter names, no abbreviations.
- If comments are needed: make them **WHY**-driven, not **HOW**.
