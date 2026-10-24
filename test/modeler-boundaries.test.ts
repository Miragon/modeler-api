import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);

interface ModelerBoundaries {
  domFreePackages: string[];
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
  const packageNames = readdirSync(join(root, "packages"))
    .filter((packageName) => existsSync(join(root, "packages", packageName, "package.json")))
    .sort();
  return { name, root, boundaries: manifest.modelerSuite, packageNames };
});

function dependsOnShell(modelerRoot: string, packageName: string) {
  const manifest = JSON.parse(
    readFileSync(join(modelerRoot, "packages", packageName, "package.json"), "utf8"),
  ) as Partial<Record<"dependencies" | "devDependencies" | "peerDependencies", object>>;
  return [manifest.dependencies, manifest.devDependencies, manifest.peerDependencies].some(
    (dependencies) => dependencies !== undefined && "@miragon/modeler-shell" in dependencies,
  );
}

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

describe.each(modelers)("$name boundaries", ({ root, boundaries, packageNames }) => {
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

  it("has no package that depends on the shell", () => {
    expect(packageNames.filter((packageName) => dependsOnShell(root, packageName))).toEqual([]);
  });

  it("keeps the shell out of every package", async () => {
    expect(packageNames).toContain("renderer");
    for (const packageName of packageNames) {
      const source = `packages/${packageName}/src/boundary-probe.ts`;
      expect(
        await restrictionsReported(root, source, 'import "@miragon/modeler-shell";'),
        source,
      ).not.toHaveLength(0);
      expect(ruleCovers(forbiddenRule(root, "packages-no-shell"), source), source).toBe(true);
    }
  });

  it("keeps the renderer outside the DOM-free rules", () => {
    const source = "packages/renderer/src/boundary-probe.ts";
    expect(ruleCovers(forbiddenRule(root, "dom-free-no-diagram-js"), source)).toBe(false);
  });
});
