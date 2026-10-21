import { defineConfig } from "vitest/config";

// The repository's own checks of the modeler-kit plugin. The template under plugins/ carries test
// files of its own, which run in the repository the template starts, never here.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 60_000,
  },
});
