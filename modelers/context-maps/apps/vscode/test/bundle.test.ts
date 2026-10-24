// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire, isBuiltin } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, type BuildOptions } from "esbuild";
import { beforeEach, describe, expect, it } from "vitest";
import * as vscodeMockModule from "./__mocks__/vscode.js";

interface Manifest {
  main: string;
  contributes: {
    customEditors: Array<{ viewType: string }>;
    commands: Array<{ command: string }>;
  };
}

interface Extension {
  activate(context: { extensionUri: unknown; subscriptions: unknown[] }): void;
}

const appDirectory = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(readFileSync(join(appDirectory, "package.json"), "utf8")) as Manifest;
const bundlePath = join(appDirectory, manifest.main);

/** The host bundle `vscode:prepublish` builds into the VSIX, built in memory. */
async function buildShippedHostBundle(): Promise<string> {
  // A computed specifier: the config is plain JS without types, and esbuild needs Node, not Vite.
  const configUrl = pathToFileURL(join(appDirectory, "esbuild.config.mjs")).href;
  const { hostOptions } = (await import(/* @vite-ignore */ configUrl)) as {
    hostOptions(production: boolean): BuildOptions;
  };
  const result = await build({ ...hostOptions(true), write: false, logLevel: "silent" });
  const output = result.outputFiles?.[0];
  if (!output) throw new Error("esbuild produced no host bundle");
  return output.text;
}

/**
 * Runs the bundle as VS Code runs it from the VSIX: `vscode` from the host, Node's built-ins,
 * nothing else.
 */
function loadBundle(code: string, vscode: unknown): Extension {
  const nodeRequire = createRequire(bundlePath);
  const require = (id: string): unknown => {
    if (id === "vscode") return vscode;
    if (isBuiltin(id)) return nodeRequire(id);
    throw new Error(`the bundle requires "${id}" at runtime, which the VSIX doesn't ship`);
  };
  const module = { exports: {} };
  new Function("module", "exports", "require", "__filename", "__dirname", code)(
    module,
    module.exports,
    require,
    bundlePath,
    dirname(bundlePath),
  );
  return module.exports as Extension;
}

beforeEach(() => vscodeMockModule.vscodeMock.reset());

// The VSIX ships the bundle without node_modules: a require esbuild left in it throws when VS Code
// loads the extension, activate never runs and the custom editors never open.
describe("the extension host bundle in the VSIX", () => {
  it("loads on its own and registers both diagram editors and every command", async () => {
    const registeredEditors: string[] = [];
    const vscode = {
      ...vscodeMockModule,
      window: {
        ...vscodeMockModule.window,
        registerCustomEditorProvider: (viewType: string) => {
          registeredEditors.push(viewType);
          return new vscodeMockModule.Disposable(() => undefined);
        },
      },
    };

    const extension = loadBundle(await buildShippedHostBundle(), vscode);
    extension.activate({
      extensionUri: vscodeMockModule.Uri.file("/extension"),
      subscriptions: [],
    });

    expect(registeredEditors).toEqual(
      manifest.contributes.customEditors.map((editor) => editor.viewType),
    );
    expect(vscodeMockModule.vscodeMock.registeredCommandIds().sort()).toEqual(
      manifest.contributes.commands.map((command) => command.command).sort(),
    );
  }, 60_000);
});
