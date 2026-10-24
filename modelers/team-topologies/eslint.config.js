import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import { modelerEslintConfig } from "../../tooling/eslint.mjs";

const reactHooksRules = {
  "react-hooks/rules-of-hooks": "error",
  "react-hooks/exhaustive-deps": "warn",
};

const uiBrowserAndReactRules = {
  files: ["packages/ui/**/*.{ts,tsx}"],
  languageOptions: { globals: globals.browser },
  plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
  rules: {
    ...reactHooksRules,
    "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
  },
};

const webviewWithoutHotReloadReactRules = {
  files: ["apps/vscode/**/*.tsx"],
  plugins: { "react-hooks": reactHooks },
  rules: reactHooksRules,
};

export default modelerEslintConfig(
  import.meta.dirname,
  uiBrowserAndReactRules,
  webviewWithoutHotReloadReactRules,
);
