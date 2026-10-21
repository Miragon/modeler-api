# Miragon modeler API

The shared foundation of the Miragon modelers (Wardley Maps, Team Topologies,
Context Maps, Event Storming, Value Chain): ONE contract every modeler
implements, and — next to it — the code every modeler would otherwise
re-implement around its canvas.

This repository is an npm workspace. Each package under `packages/` is
versioned, tagged (`<component>-vX.Y.Z`, e.g. `modeler-api-v1.0.0`) and
published on its own.

| Package                                    | Path             | Status                                                                                                                                                                                   |
| ------------------------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@miragon/modeler-api`](packages/api)     | `packages/api`   | the collaborative-modeler contract and its conformance kit, 0 runtime dependencies                                                                                                       |
| [`@miragon/modeler-shell`](packages/shell) | `packages/shell` | the shared chrome around diagram-js modelers (menu, palette skin, zoom panel, keys, fit, VS Code plumbing) and its conformance kit, 0 runtime dependencies, [API](packages/shell/API.md) |

The contract's laws, the conformance kit and its versioning are documented in
the [package README](packages/api/README.md). The plan for the shell, the
contract roadmap and the rollout across the modeler repositories live in
[#4](https://github.com/Miragon/modeler-api/issues/4).

## Claude Code plugin

[`plugins/modeler-kit/`](plugins/modeler-kit/) ships the **`new-modeler`** skill: how to build a
new Miragon modeler end to end on these two packages, with a runnable template and the script that
instantiates it. Install it with

```text
/plugin marketplace add Miragon/modeler-api
/plugin install modeler-kit@modeler-api
```

`npm test` keeps it in step with the packages (see [CONTRIBUTING.md](CONTRIBUTING.md#plugin)).

## Docs

- [Shell implementation notes](docs/shell/implementation-notes.md): how
  `@miragon/modeler-shell` implements the chrome anatomy and the IDE-host
  rules of the Miragon design system with diagram-js, VS Code and browser
  APIs, section by section, with the rule each section implements.

## Development

```sh
npm ci
npm run lint      # tsc in every package + prettier over the repo
npm test          # every package's own suite, then the plugin's drift test
npm run build     # every package
npm run test:e2e  # Playwright (the shell's demo); once: npx playwright install chromium
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for commits, releases and the checks CI
runs.

## License

MIT
