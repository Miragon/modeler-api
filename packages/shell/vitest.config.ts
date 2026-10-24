import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: [
            "src/core/**/*.test.ts",
            "src/testing/vscode-electron/**/*.test.ts",
            "test/**/*.test.ts",
          ],
        },
      },
      {
        test: {
          name: "dom",
          environment: "happy-dom",
          include: [
            "src/dom/**/*.test.ts",
            "src/diagram-js/**/*.test.ts",
            "src/vscode/**/*.test.ts",
            "src/testing/**/*.test.ts",
          ],
          exclude: [...configDefaults.exclude, "src/testing/vscode-electron/**"],
        },
      },
    ],
  },
});
