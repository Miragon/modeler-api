import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  parseDocumentText,
  serializeDocumentText,
  type CmDocument,
} from "@miragon/context-maps-schema-model";
import { formatVsCodeSmoke, runVsCodeSmoke } from "@miragon/modeler-shell/testing/vscode-electron";
import { createVSIX } from "@vscode/vsce";
import { afterAll, beforeAll, expect, it } from "vitest";
import { WEBVIEW_THEMES } from "../src/themes.js";

const appDirectory = fileURLToPath(new URL("..", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const screenshotDirectory = join(repositoryRoot, "test-results/vscode-smoke");
const fixtureFile = new URL("fixtures/ordering.cm", import.meta.url);

let packageDirectory: string | undefined;
let extensionPath: string;

/**
 * The extension as the release ships it: `vsce package --no-dependencies` runs `vscode:prepublish`
 * and applies `.vscodeignore`, and the unpacked VSIX lies outside the repository, so a module the
 * bundle still requires at runtime cannot fall back to the workspace's node_modules.
 */
async function packAndUnpackExtension(): Promise<string> {
  packageDirectory = await mkdtemp(join(tmpdir(), "context-maps-vsix-"));
  const vsixPath = join(packageDirectory, "context-maps-modeler.vsix");
  await createVSIX({ cwd: appDirectory, packagePath: vsixPath, dependencies: false });
  await promisify(execFile)("unzip", ["-q", vsixPath, "-d", packageDirectory]);
  return join(packageDirectory, "extension");
}

function parseMap(text: string): CmDocument {
  const parsed = parseDocumentText(text);
  if (!parsed.ok) {
    const issues = parsed.issues ?? [{ path: [], message: parsed.error }];
    throw new Error(
      issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; "),
    );
  }
  return parsed.document;
}

/** Straight to stdout: Vitest would put a header above every console line of the progress log. */
function report(line: string): void {
  process.stdout.write(`${line}\n`);
}

beforeAll(async () => {
  extensionPath = await packAndUnpackExtension();
}, 300_000);

afterAll(async () => {
  if (packageDirectory) await rm(packageDirectory, { recursive: true, force: true });
});

async function openEditSaveUndoAndTheme(): Promise<void> {
  const fixtureText = await readFile(fixtureFile, "utf8");
  const fixture = parseMap(fixtureText);

  const result = await runVsCodeSmoke({
    extensionPath,
    fixture: { fileName: "ordering.cm", text: fixtureText },
    parse: parseMap,
    themes: WEBVIEW_THEMES,
    name: "context-maps",
    screenshotDir: screenshotDirectory,
    vscodeVersion: process.env.VSCODE_SMOKE_VERSION || undefined,
    log: (line) => report(`[vscode-smoke] ${line}`),
  });
  report(formatVsCodeSmoke(result));

  // Soft, so a failure of another step (a theme, say) cannot hide what is wrong with the save.
  expect.soft(result.failures).toEqual([]);
  expect(result.saved, "the driver read no saved file").toBeDefined();
  expect(result.saved?.text, "the extension saved an empty file").not.toBe("");
  const saved = result.saved?.parsed as CmDocument | undefined;
  expect(
    saved?.contexts,
    "the saved map should hold one context more than the fixture",
  ).toHaveLength(fixture.contexts.length + 1);
  expect(saved?.relationships, "the save should keep the fixture's relationships").toEqual(
    fixture.relationships,
  );
  expect(result.saved?.text, "the saved text should be canonical").toBe(
    saved && serializeDocumentText(saved),
  );
}

it(
  "opens, edits, saves, undoes and themes a context map in a real VS Code",
  { timeout: 600_000 },
  openEditSaveUndoAndTheme,
);
