import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// The demo bundles the shell from source, so it runs without a prior build.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  server: { port: 5181, strictPort: true },
});
