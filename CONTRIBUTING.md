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
  the PR title (`feat!:`, major). Wording-only changes are `docs`. A kit case
  that enforces what the contract text already states is not a stricter law
  (`fix`, or `feat` when it comes with a new optional harness field); a
  requirement the text does not state yet ships as a RECOMMENDATION whose
  case only advises, and becomes a law in the next major.
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

| Path             | Package                  |
| ---------------- | ------------------------ |
| `packages/api`   | `@miragon/modeler-api`   |
| `packages/shell` | `@miragon/modeler-shell` |

Next to the packages: `plugins/modeler-kit/`, the Claude Code plugin with the `new-modeler` skill
(served by the marketplace in `.claude-plugin/marketplace.json`, see [Plugin](#plugin)), and
`test/`, the repository-level checks that guard it.

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

The first release of a new package also needs one manual step on npm: trusted publishing (OIDC)
can only be bound to a package that already exists, so the release job's `npm publish` fails with
E404 for a name npm has never seen. This is how `@miragon/modeler-api@1.0.0` was bootstrapped:

1. Merge the package's first release PR as usual. The tag is created, the publish job fails (expected).
2. A maintainer with publish rights to the `@miragon` scope publishes that version once by hand from a
   clean checkout of the tag: `npm ci && npm run build -w packages/<name> && npm publish -w packages/<name>`
   (2FA in the browser; in a non-interactive shell npm aborts the web 2FA with EOTP, so run it in a
   terminal). npm briefly lists a `0.0.0-stage` placeholder while it processes the first upload.
3. Bind the trusted publisher: `npm trust github @miragon/<name> --repo Miragon/modeler-api --file release-please.yml --env npm --allow-publish`.
4. Re-run the failed publish job. It skips with "already published"; from the next release on it
   publishes without a token.

## Plugin

`plugins/modeler-kit/skills/new-modeler/` holds the skill (`SKILL.md`, `references/`), the template
a new modeler repository starts from (`assets/template/`, placeholders `__NOTATION__`,
`__DISPLAY_NAME__`, `__EXT__`, `__REPO__`) and the script that fills them
(`scripts/new-modeler.mjs`). It lives outside `packages/`, so release-please releases nothing for
a change there whatever its type; use the scope `plugin` (`feat(plugin): …`, `fix(plugin): …`).

- **No version.** Neither `plugins/modeler-kit/.claude-plugin/plugin.json` nor its entry in
  `.claude-plugin/marketplace.json` sets `version`, and the drift test fails when one does. Claude
  Code then versions the plugin by the commit of its directory, so every merged change, the
  template pins release-please rewrites in its release commit included, reaches installed copies
  on their next update.
  A fixed version would hold installed copies until someone bumped it, and no one bumps it for
  release-please's rewrite.
- **Pins.** The template's `@miragon/modeler-api` and `@miragon/modeler-shell` pins follow the
  releases: each package's `extra-files` in `release-please-config.json` names the template's
  `package.json` fields it rewrites (root-relative paths, leading `/`). A new pin in the template
  needs a new entry there.
- **The drift test** (`test/new-modeler-skill.test.ts`, `npm run test:plugin`, part of `npm test`)
  fails when the template's platform pins differ from the workspace versions or lack their
  `extra-files` entry, when the template pins anything loosely, when a placeholder is undocumented
  or left unfilled, when the plugin or marketplace manifest is invalid or sets a `version`,
  when a link of the plugin does not resolve (its links to this repository on GitHub are checked
  against this checkout), when the skill names an identifier that neither package exports (foreign
  names are listed in the test, each with its origin), and when the template's TypeScript does not
  type-check against the packages' current sources. `zod` is a root devDependency for that last
  check only (the template's schema model uses it).
- **The template itself** builds and passes both conformance kits once instantiated: run the script
  into an empty directory outside this repository, copy the design-system files in (see the
  skill), then `npm install` and the template's checks. `claude plugin validate .` checks the
  manifests against Claude Code itself; it passes with one warning, the missing `version`, which is
  intended (so not `--strict`, which fails on any warning).

## Checks

Run from the repository root; each script fans out to every workspace
(`npm run <script> --workspaces`), `-w packages/api` targets one package.

```sh
npm ci
npm run lint      # tsc in every package + prettier over the repo
npm test          # the kit's own conformance suite (reference modeler + saboteurs),
                  # the shell's unit tests, then the plugin's drift test
npm run build     # tsup: dual ESM/CJS + d.ts
npm run publint   # the published package shape (exports, types, files)
npm run test:e2e  # Playwright suites (the shell's conformance kit against its demo);
                  # once: npx playwright install chromium
```

Adding a case to the kit means adding a saboteur flaw to
`packages/api/test/reference-modeler.ts` and its exact failure set to
`packages/api/test/conformance.test.ts` — a case without a saboteur is a case
the kit's CI cannot prove to bite. A legitimate implementation choice the kit
must accept (the enriched view-state readback) gets a variant that must fail
nothing. A RECOMMENDATION gets a variant that misses it, fails nothing and
advises exactly once.
