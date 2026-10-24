import { fileURLToPath, URL } from "node:url";
import { webHeadMarkup } from "@miragon/modeler-shell/core";
import { defineConfig, type Plugin } from "vite";
import tokens from "../../packages/renderer/src/theme/cd-tokens.generated.json" with { type: "json" };
import { THEMES } from "./src/themes.ts";

const fromHere = (path: string): string => fileURLToPath(new URL(path, import.meta.url));
const portlessUrl = process.env.PORTLESS_URL || undefined;

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

/**
 * The web app's mode before the first paint (guide §13.3): a light-only map writes
 * `data-cd-theme="light"` statically in index.html, one theme-color and the contrast line of the
 * guide's script. With the joint dark-mode release THEMES gains "dark" and the same call writes
 * the whole script with both theme-colors (index.html then says `data-cd-theme="system"`).
 */
const modeMarkup = (): Plugin => ({
  name: "miragon-mode",
  transformIndexHtml: (html) =>
    html.replace(
      "<!-- miragon-mode -->",
      webHeadMarkup({
        themes: THEMES,
        themeColors: { light: tokens.fest["--cd-blau"], dark: tokens.dunkel["--cd-ui-grund"] },
      }),
    ),
});

export default defineConfig({
  plugins: [modeMarkup(), ...(portlessUrl ? [portlessBanner(portlessUrl)] : [])],
  base: "./",
  resolve: {
    alias: [
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
  // The @miragon/context-maps-* packages are consumed from SOURCE via the aliases above. Excluding
  // them from dep pre-bundling makes Vite treat their files as first-class source: edits are
  // watched and reload the page, so the running app never serves a stale, pre-bundled renderer.
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
    // The shell and the renderer inline Lucide's icon geometry (ISC, partly Feather, MIT), the
    // renderer also Material's star and hand (Apache-2.0), and name the licences in legal
    // comments; the bundle keeps them, as the licences ask.
    rolldownOptions: { output: { comments: { legal: true } } },
  },
});
