// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

/**
 * Flat Config. The most important project-specific piece is DOM-boundary enforcement:
 * the DOM-free packages (schema-model, cml) must not import diagram-js or any DOM library/global,
 * and take only types from @miragon/modeler-api; no package imports @miragon/modeler-shell. This
 * mirrors the dependency-cruiser check so a violating import fails both `npm run lint` and
 * `npm run depcruise`.
 */

const DOM_RESTRICTED_IMPORTS = {
  paths: [
    { name: "diagram-js", message: "DOM-free packages must not import diagram-js." },
    { name: "tiny-svg", message: "DOM-free packages must not import tiny-svg." },
    { name: "min-dom", message: "DOM-free packages must not import min-dom." },
    { name: "@miragon/modeler-shell", message: "Only the apps mount the shell." },
    {
      name: "@miragon/modeler-api",
      allowTypeImports: true,
      message: "DOM-free packages take only types from the contract.",
    },
  ],
  patterns: [
    {
      group: ["diagram-js/*"],
      message: "DOM-free packages must not import diagram-js.",
    },
    { group: ["@miragon/modeler-shell/*"], message: "Only the apps mount the shell." },
    {
      group: ["@miragon/modeler-api/*"],
      allowTypeImports: true,
      message: "DOM-free packages take only types from the contract.",
    },
  ],
};

const SHELL_RESTRICTED_IMPORTS = {
  paths: [{ name: "@miragon/modeler-shell", message: "The renderer never imports the shell." }],
  patterns: [
    { group: ["@miragon/modeler-shell/*"], message: "The renderer never imports the shell." },
  ],
};

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/*.tsbuildinfo",
      "eslint.config.js",
      "**/*.config.{js,ts,mjs,cjs}",
      ".dependency-cruiser.cjs",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "no-undef": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // DOM-dependent packages/apps + E2E specs (page.evaluate runs in the browser): browser globals.
  {
    files: ["packages/renderer/**/*.ts", "apps/webapp/**/*.ts", "e2e/**/*.ts"],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  // Build and release scripts run in Node.
  {
    files: ["**/scripts/**/*.mjs"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  // The VS Code extension has a Node host AND a browser webview — allow both global sets.
  {
    files: ["apps/vscode/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
  // DOM-FREE packages: hard boundary.
  {
    files: ["packages/schema-model/**/*.ts", "packages/cml/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "no-restricted-imports": ["error", DOM_RESTRICTED_IMPORTS],
      "no-restricted-globals": [
        "error",
        { name: "window", message: "DOM-free package: no window." },
        { name: "document", message: "DOM-free package: no document." },
      ],
    },
  },
  // The renderer: the shell is the apps' chrome, never a renderer dependency.
  {
    files: ["packages/renderer/src/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", SHELL_RESTRICTED_IMPORTS],
    },
  },
  // Tests may be more lenient.
  {
    files: ["**/*.{test,spec}.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  prettier,
);
