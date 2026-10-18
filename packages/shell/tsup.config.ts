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
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    // the CSS build below runs in parallel; cleaning its output here would race it
    clean: ["**/*", "!shell.css"],
  },
  {
    entry: { shell: "src/shell.css" },
    clean: false,
  },
]);
