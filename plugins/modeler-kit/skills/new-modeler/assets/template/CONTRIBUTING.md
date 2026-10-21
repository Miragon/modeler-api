# Contributing

## Setup

```sh
npm ci
npx playwright install chromium   # once, for test:browser and test:e2e
npm run build
```

The Husky pre-commit hook runs lint-staged and `npm run lint` only; run `npm test`,
`npm run test:browser` and `npm run depcruise` before you push. Every commit is signed
(`git commit -S`).

## Commits and releases

Conventional Commits, enforced on the PR title; PRs are squash-merged with the title as the commit.
release-please releases every package as a component of its own (`<component>-vX.Y.Z`) when a
commit touches its directory: `feat` a minor, `fix` a patch, a breaking change a minor while 0.x.
`chore`, `ci`, `docs`, `test` and `refactor` release nothing. A Dependabot bump of
`@miragon/modeler-shell` lands as `fix(deps): adopt modeler-shell x.y`, so it is released.

Merging the release PR publishes the `packages/*` libraries to npm (OIDC trusted publishing,
environment `npm`) and the extension to the VS Code Marketplace and Open VSX (environment
`vscode-marketplace`, secrets `VSCE_PUBLISH`, `OVSX_PUBLISH`).

The first release of every npm package needs one manual step: trusted publishing binds only to a
package that exists. Merge the first release PR (its publish job fails with E404), publish that
version once by hand from a clean checkout of the tag (`npm ci && npm run build &&
npm publish -w packages/<name>`, in a terminal for the 2FA prompt), bind the publisher with
`npm trust github @miragon/__NOTATION__-<name> --repo Miragon/__REPO__ --file release-please.yml --env npm --allow-publish`,
then re-run the failed job.
