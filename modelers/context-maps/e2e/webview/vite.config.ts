import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const fromRepository = (path: string): string =>
  fileURLToPath(new URL(`../../${path}`, import.meta.url));

/**
 * The VS Code webview test page: apps/vscode/src/webview/main.ts inside the shell's VS Code stub.
 * Like apps/webapp/vite.config.ts it resolves @miragon/context-maps-* to the package sources, so
 * the suite runs without a prior build.
 */
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  resolve: {
    alias: [
      {
        find: "@miragon/context-maps-renderer",
        replacement: fromRepository("packages/renderer/src/index.ts"),
      },
      {
        find: "@miragon/context-maps-schema-model",
        replacement: fromRepository("packages/schema-model/src/index.ts"),
      },
      {
        find: "@miragon/context-maps-cml",
        replacement: fromRepository("packages/cml/src/index.ts"),
      },
    ],
  },
  server: {
    host: "127.0.0.1",
    port: Number(process.env.E2E_WEBVIEW_PORT ?? 5190),
    strictPort: true,
    fs: { allow: [fromRepository("")] },
  },
});
