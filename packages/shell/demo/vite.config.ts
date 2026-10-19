import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

import { documentMode, webHeadMarkup, type Theme } from "../src/core/index.js";
import tokens from "../fixtures/tokens/cd-tokens.generated.json" with { type: "json" };

const themeColors = { light: tokens.fest["--cd-blau"], dark: tokens.dunkel["--cd-ui-grund"] };

/**
 * The web app's mode before the first paint (guide §13.3), as a Miragon web app writes it into its
 * index.html: `/web.html?themes=light,dark` gets the dark-capable head (static `system` and the
 * whole script), every other `/web.html` the light-only one (static `light`, the contrast line).
 */
function webModePlugin(): Plugin {
  return {
    name: "miragon-mode",
    transformIndexHtml: {
      order: "pre",
      handler(html, context) {
        if (!context.path.endsWith("/web.html")) return html;
        const url = new URL(context.originalUrl ?? context.path, "http://demo.invalid");
        const themes = (url.searchParams.get("themes") ?? "light").split(",") as Theme[];
        const mode = documentMode("system", themes, themeColors);
        return html
          .replace('data-cd-theme="light"', `data-cd-theme="${mode.theme}"`)
          .replace("<!-- miragon-mode -->", webHeadMarkup({ themes, themeColors }));
      },
    },
  };
}

// The demo bundles the shell from source, so it runs without a prior build.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  server: { port: 5181, strictPort: true },
  plugins: [webModePlugin()],
});
