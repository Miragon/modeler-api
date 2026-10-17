# Contributing

## Commits and pull requests

- Conventional Commits, enforced on the PR title (`.github/workflows/pr-title.yml`):
  `feat`, `fix`, `chore`, `docs`, `refactor`, `ci`, `build`, `test`, `revert`.
- One conventional commit per PR on `main`: PRs are **squash-merged** with the
  PR title as the subject. A merge commit whose body repeats the title would be
  parsed by release-please as a second entry and duplicate the changelog.
- `@miragon/modeler-api` is on 1.x: a new optional surface of the contract or
  the kit is a `feat` (minor); a new required member, a stricter law or a
  breaking change to the kit's harness shape is breaking, marked with `!` in
  the PR title (`feat!:`, major). Wording-only changes are `docs`.
  `bump-minor-pre-major` only matters for a package still on 0.x.
- The PR body becomes the commit body, but GitHub's squash appends a
  `---------` / `Co-authored-by:` block after it whenever a commit has a
  co-author. A `Release-As:` footer at the end of the PR body is then no
  longer a footer, and release-please ignores it. To set a version or to
  rewrite the changelog entries a PR contributes, put the conventional
  commit(s) between `BEGIN_COMMIT_OVERRIDE` and `END_COMMIT_OVERRIDE` in the
  PR body instead (a `Release-As:` footer inside the block is honoured).
  Write the two markers nowhere else in the body: release-please takes the
  text after the first `BEGIN_COMMIT_OVERRIDE`, so an earlier mention in prose
  replaces the override with that prose and the PR releases nothing.
  release-please reads the merged PR's body on every run, so an override can
  still be added after the merge, until the next release.

## Layout

An npm workspace: the root `package.json` is private and holds the shared,
exactly pinned dev tooling (TypeScript, tsup, Vitest, publint, Prettier) so
every package builds with the same versions. Each package under `packages/`
owns its `src/`, `test/`, `tsconfig.json`, `tsup.config.ts`, `README.md` and
`LICENSE` (npm packs only the package directory, so the license is copied in).

| Path           | Package                |
| -------------- | ---------------------- |
| `packages/api` | `@miragon/modeler-api` |

## Releases

release-please opens the release PR on every push to `main`; merging it tags,
publishes the released package to npm (OIDC trusted publishing, one
`publish-npm-<package>` job per package, gated on that path's
`<path>--release_created` output) and rewrites `MODELER_API_VERSION` in
`packages/api/src/index.ts` (`extra-files`, relative to the package). Never
edit a version by hand. The `node-workspace` plugin keeps the root
`package-lock.json` entry of a released package on the new version.

release-please assigns a commit to a package only when it touches a file
under that package's path; root-only changes (CI, tooling) release nothing.

Every package is its own release-please component and is tagged
`<component>-vX.Y.Z` (`include-component-in-tag`), e.g. `modeler-api-v1.0.0`,
so the shell can release on its own line next to the contract. A new package
needs its own `packages` entry in `release-please-config.json` (`component`,
`initial-version`) and a `.release-please-manifest.json` entry of `"0.0.0"`:
release-please treats any other manifest version as the last release and
bumps from it instead of using `initial-version`.

## Checks

Run from the repository root; each script fans out to every workspace
(`npm run <script> --workspaces`), `-w packages/api` targets one package.

```sh
npm ci
npm run lint      # tsc in every package + prettier over the repo
npm test          # the kit's own conformance suite (reference modeler + saboteurs)
npm run build     # tsup: dual ESM/CJS + d.ts
npm run publint   # the published package shape (exports, types, files)
```

Adding a case to the kit means adding a saboteur flaw to
`packages/api/test/reference-modeler.ts` and its exact failure set to
`packages/api/test/conformance.test.ts` — a case without a saboteur is a case
the kit's CI cannot prove to bite. A legitimate implementation choice the kit
must accept (the enriched view-state readback) gets a variant that must fail
nothing.
