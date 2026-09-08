# Contributing

## Commits and pull requests

- Conventional Commits, enforced on the PR title (`.github/workflows/pr-title.yml`):
  `feat`, `fix`, `chore`, `docs`, `refactor`, `ci`, `build`, `test`, `revert`.
- One conventional commit per PR on `main`: PRs are **squash-merged** with the
  PR title as the subject. A merge commit whose body repeats the title would be
  parsed by release-please as a second entry and duplicate the changelog.
- A change to the contract's laws or the kit's harness shape is a `feat` (pre-1.0:
  breaking changes bump the minor, `bump-minor-pre-major`); wording-only
  changes are `docs`.

## Releases

release-please opens the release PR on every push to `main`; merging it tags,
publishes to npm (OIDC trusted publishing, `publish-npm` job) and rewrites
`MODELER_API_VERSION` in `src/index.ts` (`extra-files`). Never edit the version
by hand.

## Checks

```sh
npm ci
npm run lint      # tsc + prettier
npm test          # the kit's own conformance suite (reference modeler + saboteurs)
npm run build     # tsup: dual ESM/CJS + d.ts
npm run publint   # the published package shape (exports, types, files)
```

Adding a case to the kit means adding a saboteur flaw to
`test/reference-modeler.ts` and its exact failure set to
`test/conformance.test.ts` — a case without a saboteur is a case the kit's CI
cannot prove to bite. A legitimate implementation choice the kit must accept
(the enriched view-state readback) gets a variant that must fail nothing.
