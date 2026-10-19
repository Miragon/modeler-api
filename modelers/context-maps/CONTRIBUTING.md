# Contributing

Thanks for helping improve the Context Maps Modeler. This is an npm-workspaces monorepo
(Node ≥ 24.15, npm, TypeScript ESM). Agent-oriented notes live in [`CLAUDE.md`](CLAUDE.md).

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
