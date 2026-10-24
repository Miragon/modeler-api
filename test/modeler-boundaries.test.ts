import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);

interface ModelerBoundaries {
  domFreePackages: string[];
  shellMountingPackages?: string[];
}

interface ForbiddenRule {
  name: string;
  from: { path?: string; pathNot?: string };
}

const modelers = readdirSync(join(ROOT, "modelers")).map((name) => {
  const root = join(ROOT, "modelers", name);
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    modelerSuite: ModelerBoundaries;
  };
  return { name, root, boundaries: manifest.modelerSuite };
});

async function restrictionsReported(modelerRoot: string, relativePath: string, code: string) {
  const eslint = new ESLint({ cwd: modelerRoot });
  const [result] = await eslint.lintText(code, { filePath: join(modelerRoot, relativePath) });
  return (result?.messages ?? [])
    .map((message) => message.ruleId)
    .filter((ruleId) => ruleId === "no-restricted-imports" || ruleId === "no-restricted-globals");
}

function forbiddenRule(modelerRoot: string, ruleName: string): ForbiddenRule {
  const config = require(join(modelerRoot, ".dependency-cruiser.cjs")) as {
    forbidden: ForbiddenRule[];
  };
  const rule = config.forbidden.find((candidate) => candidate.name === ruleName);
  if (!rule) throw new Error(`${modelerRoot}: no dependency-cruiser rule "${ruleName}"`);
  return rule;
}

function ruleCovers(rule: ForbiddenRule, relativePath: string) {
  const matchesPath = new RegExp(rule.from.path ?? "").test(relativePath);
  const excluded =
    rule.from.pathNot !== undefined && new RegExp(rule.from.pathNot).test(relativePath);
  return matchesPath && !excluded;
}

describe.each(modelers)("$name boundaries", ({ root, boundaries }) => {
  const shellMountingPackages = boundaries.shellMountingPackages ?? [];

  describe.each(boundaries.domFreePackages)("DOM-free package %s", (packageName) => {
    const source = `packages/${packageName}/src/boundary-probe.ts`;

    it("rejects diagram-js, DOM libraries, the shell and DOM globals in ESLint", async () => {
      for (const code of [
        'import "diagram-js";',
        'import "diagram-js/lib/core";',
        'import "tiny-svg";',
        'import "min-dom";',
        'import "@miragon/modeler-shell";',
        "export const width = window.innerWidth;",
        "export const body = document.body;",
      ]) {
        expect(await restrictionsReported(root, source, code), code).not.toHaveLength(0);
      }
    });

    it("takes only types from the contract in ESLint", async () => {
      expect(
        await restrictionsReported(
          root,
          source,
          'import { MODELER_API_VERSION } from "@miragon/modeler-api";',
        ),
      ).not.toHaveLength(0);
      expect(
        await restrictionsReported(
          root,
          source,
          'import type { CollaborativeModeler } from "@miragon/modeler-api";',
        ),
      ).toHaveLength(0);
    });

    it("is covered by every DOM-free dependency-cruiser rule", () => {
      for (const ruleName of [
        "dom-free-no-diagram-js",
        "dom-free-no-renderer",
        "dom-free-contract-types-only",
      ]) {
        expect(ruleCovers(forbiddenRule(root, ruleName), source), ruleName).toBe(true);
      }
    });
  });

  it("keeps the shell out of the renderer", async () => {
    const source = "packages/renderer/src/boundary-probe.ts";
    expect(
      await restrictionsReported(root, source, 'import "@miragon/modeler-shell";'),
    ).not.toHaveLength(0);
    expect(ruleCovers(forbiddenRule(root, "packages-no-shell"), source)).toBe(true);
    expect(ruleCovers(forbiddenRule(root, "dom-free-no-diagram-js"), source)).toBe(false);
  });

  it.runIf(shellMountingPackages.length > 0)(
    "lets the shell-mounting packages import the shell",
    async () => {
      for (const packageName of shellMountingPackages) {
        const source = `packages/${packageName}/src/boundary-probe.ts`;
        expect(
          await restrictionsReported(root, source, 'import "@miragon/modeler-shell";'),
        ).toHaveLength(0);
        expect(ruleCovers(forbiddenRule(root, "packages-no-shell"), source)).toBe(false);
      }
    },
  );
});
