import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { modelerEslintConfig } from "../../tooling/eslint.mjs";

const reactHooksRules = {
  "react-hooks/rules-of-hooks": "error",
  "react-hooks/exhaustive-deps": "warn",
};

const uiReactRules = {
  files: ["packages/ui/**/*.{ts,tsx}"],
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
  uiReactRules,
  webviewWithoutHotReloadReactRules,
);
