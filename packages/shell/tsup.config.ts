import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      core: "src/core.ts",
      "diagram-js": "src/diagram-js.ts",
      "vscode-extension": "src/vscode-extension.ts",
      "vscode-webview": "src/vscode-webview.ts",
      testing: "src/testing.ts",
      "testing-vscode-stub": "src/testing-vscode-stub.ts",
      "testing-vscode-electron": "src/testing-vscode-electron.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    // the CSS and command builds below run in parallel; cleaning their output here would race them
    clean: ["**/*", "!shell.css", "!vscode-docker.js*"],
  },
  {
    entry: { shell: "src/shell.css" },
    clean: false,
  },
  {
    // the bin: one self-contained ESM file, its shebang kept by esbuild
    entry: { "vscode-docker": "src/testing/vscode-electron/docker-cli.ts" },
    format: ["esm"],
    platform: "node",
    sourcemap: true,
    clean: false,
  },
]);
