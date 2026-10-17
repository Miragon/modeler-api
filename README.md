# Miragon modeler API

The shared foundation of the Miragon modelers (Wardley Maps, Team Topologies,
Context Maps, Event Storming, Value Chain): ONE contract every modeler
implements, and — next to it — the code every modeler would otherwise
re-implement around its canvas.

This repository is an npm workspace. Each package under `packages/` is
versioned and published on its own.

| Package                                | Path             | Status                                                                                       |
| -------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------- |
| [`@miragon/modeler-api`](packages/api) | `packages/api`   | the collaborative-modeler contract and its conformance kit, 0 runtime dependencies           |
| `@miragon/modeler-shell`               | `packages/shell` | planned: menu button, zoom panel, keys, fit and host plumbing (diagram-js, VS Code webviews) |

The contract's laws, the conformance kit and its versioning are documented in
the [package README](packages/api/README.md). The plan for the shell, the
contract roadmap and the rollout across the modeler repositories live in
[#4](https://github.com/Miragon/modeler-api/issues/4).

## Development

```sh
npm ci
npm run lint    # tsc in every package + prettier over the repo
npm test        # every package's own suite
npm run build   # every package
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for commits, releases and the checks CI
runs.

## License

MIT
