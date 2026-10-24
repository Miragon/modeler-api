---
paths:
  - "**/package.json"
---

# Always use fixed dependency versions

Never use version ranges (`^`, `~`, `>=`, `*`) in `dependencies` or `devDependencies`.
Always pin to an exact version (e.g. `"eslint": "9.17.0"`).

This includes internal `@miragon/context-maps-*` workspace deps, which use the exact local version
as found in the workspace's `package.json` (not `*`; npm still links them to the local workspace).
Exact pinning is enforced in CI by the `pin-check` job.

`peerDependencies` are the exception: the libraries a host shares with the published packages
(`zod`, `diagram-js`, `didi`, `tiny-svg`) are caret-ranged peers, so they resolve to the host's copy
instead of one of their own. Each peer is mirrored by an exact devDependency, and the apps pin it as
an exact dependency. The range must admit that devDependency, the apps' pins and the versions the
other peers require. `pin-check` ignores peers; `packages/renderer/test/peer-dependencies.test.ts`
checks all three in `npm test`.

didi is still installed twice. diagram-js 15 depends on didi `^11.0.0` itself while the repo pins
didi 12, so the didi peer admits both majors and npm nests didi 11 under diagram-js next to the
host's 12. The renderer imports only didi's types, so the injector at runtime is diagram-js's
didi 11. A single copy needs diagram-js on didi 12, or the devDependency and the apps' pins back
on 11.x.

Shared toolchain deps (`typescript`, `vitest`, `tsup`, `vite`, `playwright`) live **only** in the
root `package.json`; never re-add them to workspace manifests. Keep the root `overrides` entry for
`vite` identical to the root devDependency.

When adding a new dependency: install it first with `npm install <pkg>` (the root `.npmrc` sets
`save-exact=true`, so npm pins the exact version), then verify the installed version with
`npm ls <pkg>` or in `package-lock.json` and make sure that exact version is written into
`package.json`.
