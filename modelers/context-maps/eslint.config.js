import { modelerEslintConfig } from "../../tooling/eslint.mjs";

const grandfatheredValidateDocumentCeiling = {
  files: ["packages/schema-model/src/schema.ts"],
  rules: { complexity: ["error", 45] },
};

export default modelerEslintConfig(import.meta.dirname, grandfatheredValidateDocumentCeiling);
