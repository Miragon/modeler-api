import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/**
 * Drift guard: guide §2 (brand-lint A2) allows no em dash as a connector in what the modeler says
 * to its users: diagnostics, toasts, tooltips, labels. brand-lint reads only the colours of a
 * TypeScript file, so this test reads its strings.
 */
const modelerRoot = fileURLToPath(new URL("../../../", import.meta.url));

const SOURCE_DIRECTORIES = [
  "packages/schema-model/src",
  "packages/dsl/src",
  "packages/transforms/src",
  "packages/renderer/src",
  "apps/webapp/src",
  "apps/vscode/src",
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ts$/.test(entry.name) && !/\.d\.ts$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}

/** Every string, template and regular-expression literal of a file, with its line; no comments. */
function literals(file: string): { line: number; text: string }[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const found: { line: number; text: string }[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isRegularExpressionLiteral(node)
    ) {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      found.push({ line, text: node.text });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe("user-texts.sync: the modeler's texts join without an em dash (guide §2)", () => {
  it("finds the literals to check", () => {
    const parser = join(modelerRoot, "packages/dsl/src/parser.ts");
    expect(literals(parser).some(({ text }) => text.includes("Line not understood"))).toBe(true);
  });

  it("has no em dash in a string, template or regular-expression literal of a package or app", () => {
    const withEmDash = SOURCE_DIRECTORIES.flatMap((directory) =>
      sourceFiles(join(modelerRoot, directory)).flatMap((file) =>
        literals(file)
          .filter(({ text }) => text.includes("—"))
          .map(({ line, text }) => `${relative(modelerRoot, file)}:${line} ${text}`),
      ),
    );
    expect(withEmDash).toEqual([]);
  });
});
