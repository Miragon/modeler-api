---
paths:
  - "**/package.json"
---

# Always use fixed dependency versions

Never use version ranges (`^`, `~`, `>=`, `*`) in `dependencies` or `devDependencies`.
Always pin to an exact version (e.g. `"eslint": "9.17.0"`).

This applies to `dependencies` and `devDependencies` — including internal
`@miragon/team-topologies-*` workspace deps, which pin the current version of that workspace (not
`*`; npm still links them to the local workspace). Exact pinning is enforced in CI by the
`pin-check` job. How a release keeps internal pins in step, and whether a new internal dep needs
an entry in the release configuration, is in the suite's
[docs/ci-and-releases.md](../../../../docs/ci-and-releases.md).

**Exception — `peerDependencies` of published libraries.** Consumer-shared / singleton
runtime libs are declared as **ranged `peerDependencies`** (caret) so a downstream app
dedupes them against its own copy instead of getting a second, broken instance — duplicate
`zod` breaks schema identity / `instanceof`, and duplicate `diagram-js`/`didi` breaks the DI
injector. `schema-model` declares `zod` as a peer (its zod schema objects are part of the
public API); `renderer` declares `diagram-js`, `didi`, `tiny-svg`, `zod` as peers. Each
ranged peer is also kept as an **exact `devDependency`** for reproducible in-repo builds. The
internal dep (`schema-model` in `renderer`) stays an exact `dependency` that release-please keeps
in sync. The `pin-check` job does not check `peerDependencies` by
default, so ranges there are allowed.

When adding a new dependency: install it first with `npm install <pkg>` (the root `.npmrc` sets
`save-exact=true`, so npm pins the exact version), then verify the installed version with
`npm ls <pkg>` or in `package-lock.json` and make sure that exact version is written into
`package.json`.
