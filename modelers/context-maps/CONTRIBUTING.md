# Contributing

Thanks for helping improve the Context Maps Modeler. This is an npm-workspaces monorepo
(Node ≥ 24.15, npm, TypeScript ESM). Agent-oriented notes live in [`CLAUDE.md`](CLAUDE.md).

## External contributions

We're currently not accepting pull requests from outside the team. We don't have the resources to fully review and validate external contributions, so we can't guarantee that a merged change keeps the project free of bugs, free of security vulnerabilities or malicious code, and consistent with requirements that make sense for it. Pull requests opened by external contributors will be closed.

If you've found a bug or have an idea, please [open an issue](https://github.com/Miragon/context-maps-modeler/issues/new) instead. We read every one, and it's the best way to get something onto our radar.

## Setup & inner loop

```bash
npm install
npm run build   # builds packages/* (only needed to publish the libs; apps/tests use source)
npm test        # vitest run (unit)
npm run lint    # eslint . + type-check (same check the pre-commit hook runs)
```

Useful extras: `npm run dev:webapp`, `npm run dev:vscode`, `npm run depcruise` (module-graph check),
`npm run format` (Prettier).

### Named local URL via Portless

`npm run dev:webapp` (and the top-level `npm run dev`) serves the webapp through
[Portless](https://portless.sh) at a stable, named `.localhost` URL instead of a Vite port
(needs **Node ≥ 24.15**). Portless is a pinned **devDependency**, so `npm install` is all you need — no
global install. Config lives in [`apps/webapp/portless.json`](apps/webapp/portless.json)
(`{ "name": "context-maps-modeler", "script": "dev:app" }`): `npm run dev:webapp` runs
`portless`, which reads that config and starts the real Vite server (the `dev:app` script) behind the
proxy. `dev:app` binds `--host 127.0.0.1` (Portless can't proxy the IPv6 `::1` that `localhost`
resolves to on macOS) and `--port ${PORT}` (the ephemeral port Portless injects), and
`vite.config.ts` sets `allowedHosts: ['.localhost']` so Vite accepts the proxied Host header.

The URL is **per worktree** and Portless-derived — never hand-built: in a linked git worktree it
prepends the branch as a subdomain, so you get `http://<worktree>.context-maps-modeler.localhost:8080`
in a Conductor workspace and `http://context-maps-modeler.localhost:8080` in the main checkout. Each
worktree gets its own URL, so parallel apps never collide. On start Portless **opens your browser**
there and prints it as a `➜ Portless:` line under Vite's output.

No setup beyond `npm install` is needed: `dev:webapp` sets `PORTLESS_HTTPS=0 PORTLESS_PORT=8080`, so
Portless serves plain **HTTP on the non-privileged port 8080** and auto-starts its proxy on first run
— **no `sudo`, no CA trust, no `portless service install`**. That is what lets Conductor's non-TTY
Run button start the webapp unattended. (Portless's _default_ is an HTTPS daemon on privileged port
443, which would need `sudo`; this repo deliberately avoids that.)

Prefer a plain Vite server with no proxy? `npm run dev:webapp:plain` (or
`npm run dev:app -w apps/webapp`) runs Vite directly on `:5181` and needs none of the above.

## Browser & e2e tests

`npm run test:browser` (Vitest browser mode) runs the renderer's integration tests and the
`@miragon/modeler-api` conformance kit in Chromium. `npm run test:e2e` (Playwright, in `e2e/`) has
three projects:

| Project          | What                                                                  | Server, port                              |
| ---------------- | --------------------------------------------------------------------- | ----------------------------------------- |
| `chromium`       | the web app, with the shell's kit on the web host                     | `apps/webapp` dev server, `E2E_PORT` 5180 |
| `webkit`         | the web app in Safari's engine (without the kit, see below)           | the same                                  |
| `vscode-webview` | the VS Code webview in the shell's VS Code stub, with the shell's kit | `e2e/webview/`, `E2E_WEBVIEW_PORT` 5190   |

Run one project with `npm run test:e2e -- --project=vscode-webview`; set both ports when another
checkout already uses the defaults (`E2E_PORT=6201 E2E_WEBVIEW_PORT=6211 npm run test:e2e`). The
`vscode-webview` project also builds the production webview bundle and loads it behind the real
webview CSP. The shell's kit skips WebKit: its tab-order checks need a browser whose Tab reaches
buttons and links, which WebKit does not do by default. After `npm run build:webapp`,
`npm run check:build -w apps/webapp` checks that the production `index.html` carries the mode markup
and the bundle keeps the shell's Lucide licence comment (CI runs both). Locally, run `npx playwright install chromium webkit` once; CI installs the browsers
from the lockfile-pinned Playwright.

## VS Code smoke test

`npm run test:vscode` (Vitest project `vscode`, not part of `npm test`) checks what only a real VS
Code shows, with the shell's driver `@miragon/modeler-shell/testing/vscode-electron`. It packs the
extension as the release does (`vsce package --no-dependencies`, which runs `vscode:prepublish`),
unpacks the VSIX outside the repository and starts VS Code with it on a throwaway profile. There it
opens `apps/vscode/test-smoke/fixtures/ordering.cm` in the custom editor, creates a context through
the palette's keyboard path and saves: the file has to parse (`parseDocumentText`), hold one more
context and be canonical JSON. Then it undoes (canvas and file are the fixture again) and switches
through VS Code's four default themes, with one screenshot per theme in `test-results/vscode-smoke/`
(gitignored). A run takes about 5 s once VS Code is downloaded.

No build first in either way below: the test packs the extension itself.

**Locally, without a window: Docker.** The way to run the smoke test on your machine:

```bash
npm run test:vscode:docker                                 # the newest stable VS Code
npm run test:vscode:docker -- --env VSCODE_VERSION=1.96.0  # here the engines.vscode floor
npm run test:vscode:docker -- --env VSCODE_SMOKE_KEEP=1    # brings VS Code's logs back
```

`test:vscode:docker` is the shell's command `modeler-shell-vscode-docker`: it runs
`npm run test:vscode` in a Linux container under `xvfb-run -a`, so no VS Code window opens and
nothing takes the focus. The host needs Docker (Docker Desktop on macOS) and `npm install`, nothing
else. The command copies the repository into the container without `node_modules` and `.git`, so
uncommitted changes are tested too, runs `npm ci` there and copies `test-results/vscode-smoke/`
back, emptied first, with VS Code's logs in `vscode-logs/` when `VSCODE_SMOKE_KEEP=1` kept them. The
first run builds the image `modeler-shell-vscode-smoke:node<version>-<hash>` (about 0.9 GB, on the
Node version that runs the command) and downloads VS Code into the Docker volume
`modeler-shell-vscode-cache`; the image, that volume and npm's cache volume
`modeler-shell-npm-cache` are shared by every Miragon modeler on the machine, so let a first
download finish before starting a second run. After that a run takes 8 to 15 s, `npm ci` included.
Paths in the test's output are the container's (`/work/…`). The container packs its own copy, so
your `apps/vscode/dist` stays as it is. `npm run test:vscode:docker -- --help` lists the options;
`docker volume rm modeler-shell-vscode-cache modeler-shell-npm-cache` starts over.

**With a window: macOS.** `npm run test:vscode` runs the same test directly on the host, for when
you want to watch VS Code:

```bash
npm run test:vscode                        # the newest stable VS Code
VSCODE_VERSION=1.96.0 npm run test:vscode  # another version, here the engines.vscode floor
VSCODE_SMOKE_KEEP=1 npm run test:vscode    # keeps VS Code's profile and logs, prints where
```

A VS Code window opens for a few seconds and takes the focus (Electron has no headless mode on
macOS). The first run downloads VS Code (320 to 360 MB, 0.9 GB unpacked) into
`~/Library/Caches/miragon-modeler-shell/vscode-test`, which every Miragon modeler on the machine
shares; let one download finish before starting a second run. Packing in your checkout rebuilds
`apps/vscode/dist` in production mode, so run `npm run build:vscode` (or `npm run dev:vscode`)
afterwards for a debug build. The VSIX is unpacked with `unzip` (macOS and Ubuntu have it).

**Linux and CI.** VS Code needs an X server: `xvfb-run -a npm run test:vscode`. CI runs it in the
reusable workflow [`.github/workflows/vscode-smoke.yml`](.github/workflows/vscode-smoke.yml), which
`ci.yml` calls as the job `vscode-smoke`, so its result is part of the `ci-ok` gate; when it runs
there is described in [CI and the merge gate](#ci-and-the-merge-gate). Two jobs on `ubuntu-latest`,
the newest stable VS Code and the `engines.vscode` floor (read from `apps/vscode/package.json` at
run time), with the download cached per version, the screenshots uploaded as the artifacts
`vscode-smoke-stable` and `vscode-smoke-minimum` and, when a run failed, VS Code's logs (the jobs
run with `VSCODE_SMOKE_KEEP=1`) as `vscode-smoke-logs-stable` or `vscode-smoke-logs-minimum`.
[`vscode-smoke-weekly.yml`](.github/workflows/vscode-smoke-weekly.yml) runs the same every Monday,
to catch a new VS Code release, and when it fails opens the issue "VS Code smoke: the weekly run
failed" or comments on the open one. Run either on demand under Actions → Run workflow, for any
branch. CI stays on `xvfb-run` rather than the Docker command: a runner has no desktop whose focus a
window could take, `ubuntu-latest` already has VS Code's libraries, and the Docker command would
build its 0.9 GB image and run `npm ci` a second time in every job, with VS Code's download in a
Docker volume that the workflow's cache step cannot keep.

**Release.** The release jobs that publish the extension to the VS Code Marketplace and to Open VSX
smoke-test the VSIX they are about to upload, in the newest stable VS Code, before `vsce publish`
and `ovsx publish`; a failure stops the upload. `VSCODE_SMOKE_VSIX` names that file (a path
relative to the repository root works too): the test unpacks it instead of packing its own. The
release's dry run (`workflow_dispatch` with `dry_run`) runs the same step. When that smoke fails,
its screenshots and VS Code's logs are uploaded as the artifact `vscode-smoke-marketplace`,
`vscode-smoke-open-vsx` or `vscode-smoke-dry-run`.

The test retries nothing. The shell's driver (since 0.3.2) reads the saved file only after the
editor tab has turned clean, which VS Code does once its write has resolved, and only when two reads
100 ms apart agree; a text the parser rejects is read again until it has stayed the same for 1 s. A broken
save therefore fails with what went wrong ("Meta+s wrote nothing to disk", "the editor is still
dirty after the save", "the saved text does not parse: …"; `Control+s` on Linux), and an extension
that saves an empty file fails with "the extension saved an empty file". The driver's failures are a
soft assertion: the test's own checks of the saved map run after them, so a failure in another
step, such as a theme that never switched, cannot hide a broken save.

## CI and the merge gate

[`ci.yml`](.github/workflows/ci.yml) runs on every pull request, on pushes to `main`, in the merge
queue and on demand. Its last job, **`ci-ok`, is the merge gate**: it and the pull request title
check (`validate-pr-title`) are the checks for the `main` ruleset to require, in place of the single
jobs, so that Dependabot's auto-merge waits for every job of `ci.yml`, the VS Code smoke included.
`ci-ok` runs after every other job of `ci.yml`, whatever their results, and fails, with one error
per job, when one of them failed, was cancelled or was skipped. A skip counts as a failure because
GitHub counts a skipped required check as passed, and `e2e` and `test-browser` are skipped whenever
`lint` or `build` fails. The one exception is a job whose own `if:` skips it on this event by
design, listed in `SKIPPED_BY_DESIGN`: today only `dependency-review`, which runs on pull requests
only.

**A new job in `ci.yml` goes into `ci-ok`'s `needs`.** A job missing there can fail without blocking
a merge. A job that its own `if:` skips on some events also goes into `SKIPPED_BY_DESIGN` for those
events.

**When the VS Code smoke test runs.** Its first job, `changes`, compares the commit under test with
its base: the pull request's base commit, the commit before a push, the merge queue's base commit.
The two VS Code jobs run only when one of the changed files is one the packed extension or the test
depends on: `package-lock.json`, any `package.json`, `apps/vscode/**`, `packages/**`,
`tsconfig.base.json`, `vitest.config.ts`, `.github/actions/setup/**`, `ci.yml` and the two smoke
workflows (`is_relevant` in `vscode-smoke.yml`). A moved file counts under its old path too, so a
file that leaves `apps/vscode/**` runs the smoke. Without a base to compare with (a new branch, a
base a force push removed) they run. The weekly run and a run started by hand always run. When they
do not run, the job `skipped` ends the workflow in a success with a notice, so `ci-ok` sees a
success and never a skip.

## Design tokens

The design system's files in `packages/renderer/src/theme/` (`cd-tokens.generated.css`,
`cd-tokens.generated.json`, `cd-canvas.css`) are copied unchanged from the
`miragon-brand:modeler-tool-design` skill's `assets/`. To update them, copy the new release's files
over the old ones, then update the hashes and the release in
`packages/renderer/test/theme.sync.test.ts`, `MIRAGON` in `theme/palette.ts` where a value changed,
and run `npm test`. Never edit the files by hand, and keep Prettier away from them (they are in
`.prettierignore`).

## Pre-commit reality

The Husky hook (`.husky/pre-commit`) runs **only** `lint-staged` + `npm run lint` — i.e. ESLint and
type-check. It does **not** run tests, the build, or dependency-cruiser. So before you push, run
`npm test` (and `npm run depcruise` if you touched imports) yourself. `git commit --no-verify` bypasses
the hook — avoid it.

## Commit convention

[Conventional Commits](https://www.conventionalcommits.org/) — primarily `feat`, `fix`, `refactor`,
`chore`, `docs`.

```
feat(renderer): add an OHS/PL integration-role decorator
fix(schema-model): keep colours on the migration round-trip
docs: add contributing guide
```

## Monorepo map & the DOM boundary (P1)

| Package                              | Purpose                                                         | DOM      |
| ------------------------------------ | --------------------------------------------------------------- | -------- |
| `@miragon/context-maps-schema-model` | Types, notation spec, Zod validation, serialization             | DOM-free |
| `@miragon/context-maps-cml`          | Context Mapper CML parser and serializer                        | DOM-free |
| `@miragon/context-maps-renderer`     | diagram-js bootstrap, renderer, viewer, import/export, contract | DOM      |
| `apps/webapp`                        | Vite demo editor on the modeler shell                           | DOM      |
| `apps/vscode`                        | VS Code custom editors for `.cm`/`.cm.json` and `*.cm.png`      | DOM      |

**P1 — the DOM boundary:** the DOM-free packages (`schema-model`, `cml`) must **never** import
`diagram-js`/DOM libraries (`tiny-svg`, `min-dom`) or use the DOM (`window`/`document`). This is
enforced twice — by ESLint (`no-restricted-imports`/`no-restricted-globals`) **and** by
dependency-cruiser — so a violating import fails `npm run lint` and `npm run depcruise`. The same two
checks keep `@miragon/modeler-shell` out of every package (only the apps mount the chrome) and let the
DOM-free packages take only types from `@miragon/modeler-api`.

Also keep JSON serialization deterministic.

## Pull requests

- Keep PRs small and focused.
- Make sure local gates are green: `npm run lint`, `npm test`, `npm run depcruise`, `npm run build`.
