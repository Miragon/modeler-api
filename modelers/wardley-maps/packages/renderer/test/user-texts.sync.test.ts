import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/**
 * Drift guard: guide §2 (brand-lint A2) allows no dash as a connector in what the modeler says to
 * its users: diagnostics, toasts, tooltips, labels. brand-lint reads only the colours of a
 * TypeScript file, so this test reads its strings, with A2's own pattern: an em dash, or an en dash
 * after a space and before a space, a punctuation mark or the end. Ranges such as `2–4` pass.
 */
const modelerRoot = fileURLToPath(new URL("../../../", import.meta.url));

const CONNECTOR_DASH = /—| –(?=[\s,;.:!?)]|$)/;

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

describe("user-texts.sync: the modeler's texts join without a connector dash (guide §2)", () => {
  it("finds the literals to check", () => {
    const parser = join(modelerRoot, "packages/dsl/src/parser.ts");
    expect(literals(parser).some(({ text }) => text.includes("Line not understood"))).toBe(true);
  });

  it("flags an em dash and a spaced en dash, but not a range", () => {
    const texts = ["Not found — kept", "Not found – kept", "Not found –", "From 0.2–0.4"];
    expect(texts.map((text) => CONNECTOR_DASH.test(text))).toEqual([true, true, true, false]);
  });

  it("has no connector dash in a string, template or regular-expression literal of a package or app", () => {
    const withConnectorDash = SOURCE_DIRECTORIES.flatMap((directory) =>
      sourceFiles(join(modelerRoot, directory)).flatMap((file) =>
        literals(file)
          .filter(({ text }) => CONNECTOR_DASH.test(text))
          .map(({ line, text }) => `${relative(modelerRoot, file)}:${line} ${text}`),
      ),
    );
    expect(withConnectorDash).toEqual([]);
  });
});
