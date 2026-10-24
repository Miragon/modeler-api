import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import jsdoc from "eslint-plugin-jsdoc";
import globals from "globals";
import { readModelerBoundaries } from "./modeler-boundaries.cjs";

const SHELL_MESSAGE = "Only the apps mount the shell; no package under packages/ imports it.";
const CONTRACT_MESSAGE = "DOM-free packages take only types from the contract.";

const SHELL_RESTRICTED_IMPORTS = {
  paths: [{ name: "@miragon/modeler-shell", message: SHELL_MESSAGE }],
  patterns: [{ group: ["@miragon/modeler-shell/*"], message: SHELL_MESSAGE }],
};

const DOM_RESTRICTED_IMPORTS = {
  paths: [
    { name: "diagram-js", message: "DOM-free packages must not import diagram-js (P1)." },
    { name: "tiny-svg", message: "DOM-free packages must not import tiny-svg (P1)." },
    { name: "min-dom", message: "DOM-free packages must not import min-dom (P1)." },
    ...SHELL_RESTRICTED_IMPORTS.paths,
    { name: "@miragon/modeler-api", allowTypeImports: true, message: CONTRACT_MESSAGE },
  ],
  patterns: [
    { group: ["diagram-js/*"], message: "DOM-free packages must not import diagram-js (P1)." },
    ...SHELL_RESTRICTED_IMPORTS.patterns,
    { group: ["@miragon/modeler-api/*"], allowTypeImports: true, message: CONTRACT_MESSAGE },
  ],
};

const IGNORED_FILES = {
  ignores: [
    "**/dist/**",
    "**/node_modules/**",
    "**/coverage/**",
    "**/*.tsbuildinfo",
    "eslint.config.js",
    "**/*.config.{js,ts,mjs,cjs}",
    ".dependency-cruiser.cjs",
  ],
};

const TYPESCRIPT_RULES = {
  files: ["**/*.{ts,tsx}"],
  languageOptions: { ecmaVersion: 2022, sourceType: "module" },
  plugins: { jsdoc },
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/consistent-type-imports": [
      "error",
      { prefer: "type-imports", fixStyle: "inline-type-imports" },
    ],
    "jsdoc/check-alignment": "error",
    "jsdoc/multiline-blocks": "error",
    "jsdoc/no-multi-asterisks": "error",
  },
};

const SOURCE_COMPLEXITY_RATCHET = {
  files: ["packages/*/src/**/*.{ts,tsx}", "apps/*/src/**/*.{ts,tsx}"],
  ignores: ["**/*.{test,spec}.{ts,tsx}"],
  rules: {
    complexity: ["error", 40],
    "max-depth": ["error", 6],
    "max-lines-per-function": ["error", { max: 150, skipBlankLines: true, skipComments: true }],
  },
};

const VSCODE_HOST_AND_WEBVIEW_GLOBALS = {
  files: ["apps/vscode/**/*.{ts,tsx}"],
  languageOptions: { globals: { ...globals.node, ...globals.browser } },
};

const NODE_SCRIPT_AND_TEST_GLOBALS = {
  files: ["**/*.mjs", "**/*.{test,spec}.{ts,tsx}"],
  languageOptions: { globals: globals.node },
};

function sourcesOf(packageNames) {
  return packageNames.map((packageName) => `packages/${packageName}/**/*.{ts,tsx}`);
}

export function modelerEslintConfig(modelerRoot, ...modelerConfigs) {
  const { domFreePackages } = readModelerBoundaries(modelerRoot);
  return tseslint.config(
    IGNORED_FILES,
    js.configs.recommended,
    ...tseslint.configs.recommended,
    { languageOptions: { parserOptions: { tsconfigRootDir: modelerRoot } } },
    TYPESCRIPT_RULES,
    SOURCE_COMPLEXITY_RATCHET,
    {
      files: ["packages/renderer/**/*.{ts,tsx}", "apps/**/*.{ts,tsx}", "e2e/**/*.ts"],
      languageOptions: { globals: globals.browser },
    },
    VSCODE_HOST_AND_WEBVIEW_GLOBALS,
    NODE_SCRIPT_AND_TEST_GLOBALS,
    ...modelerConfigs,
    {
      files: ["packages/*/src/**/*.{ts,tsx}"],
      rules: { "no-restricted-imports": ["error", SHELL_RESTRICTED_IMPORTS] },
    },
    {
      files: sourcesOf(domFreePackages),
      languageOptions: { globals: globals.node },
      rules: {
        "no-restricted-imports": ["error", DOM_RESTRICTED_IMPORTS],
        "no-restricted-globals": [
          "error",
          { name: "window", message: "DOM-free package: no window (P1)." },
          { name: "document", message: "DOM-free package: no document (P1)." },
        ],
      },
    },
    prettier,
  );
}
