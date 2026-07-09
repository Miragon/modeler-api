import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const fromHere = (p: string): string => fileURLToPath(new URL(p, import.meta.url));
const portlessUrl = process.env.PORTLESS_URL || undefined;

/**
 * The Modeler instance lives in a React ref and survives Fast Refresh, so an
 * HMR patch of the renderer/schema-model source would leave the RUNNING
 * modeler on stale code (fixes appear "not working" until a manual reload).
 * Force a full page reload whenever workspace-package source changes.
 */
const fullReloadOnPackageChange = (): Plugin => ({
  name: "full-reload-on-package-change",
  handleHotUpdate({ file, server }) {
    if (/\/packages\/(renderer|schema-model|cml)\/src\//.test(file)) {
      server.ws.send({ type: "full-reload" });
      return [];
    }
  },
});

const portlessBanner = (url: string): Plugin => ({
  name: "portless-url-banner",
  configureServer(server) {
    const printUrls = server.printUrls.bind(server);
    server.printUrls = () => {
      printUrls();
      server.config.logger.info(
        `  \x1b[32m➜\x1b[0m  \x1b[1mPortless\x1b[0m: \x1b[36m${url}\x1b[0m`,
      );
    };
  },
});

export default defineConfig({
  plugins: [
    react(),
    fullReloadOnPackageChange(),
    ...(portlessUrl ? [portlessBanner(portlessUrl)] : []),
  ],
  base: "./",
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      { find: "@", replacement: fromHere("./src") },
      {
        find: "@miragon/context-maps-renderer/assets/context-maps.css",
        replacement: fromHere("../../packages/renderer/src/assets/context-maps.css"),
      },
      {
        find: "@miragon/context-maps-renderer",
        replacement: fromHere("../../packages/renderer/src/index.ts"),
      },
      {
        find: "@miragon/context-maps-cml",
        replacement: fromHere("../../packages/cml/src/index.ts"),
      },
      {
        find: "@miragon/context-maps-schema-model",
        replacement: fromHere("../../packages/schema-model/src/index.ts"),
      },
    ],
  },
  // The @miragon/context-maps-* packages are consumed from SOURCE via the aliases
  // above. Excluding them from dep pre-bundling makes Vite treat their files as
  // first-class source: edits are watched and hot-reloaded, so the running app
  // never serves a stale, pre-bundled renderer while the app code is fresh.
  optimizeDeps: {
    exclude: [
      "@miragon/context-maps-renderer",
      "@miragon/context-maps-schema-model",
      "@miragon/context-maps-cml",
    ],
  },
  server: {
    port: 5181,
    strictPort: true,
    open: portlessUrl ?? false,
    allowedHosts: [".localhost"],
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
