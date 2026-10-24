import { EventEmitter } from "node:events";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it, vi } from "vitest";

import {
  fakeTestElectron,
  readInstall,
  type InstallContent,
} from "../../../test/support/test-electron.js";
import { runVsCodeSmoke, type VsCodeSmokeOptions } from "./driver.js";
import { activeTextEditorProbe, workbenchWebviewsProbe } from "./webview.js";

const peers = vi.hoisted(() => ({
  download: (_options: { cachePath?: string | undefined }): Promise<string> => {
    throw new Error("no download set");
  },
  launch: (_options: { executablePath: string; args: string[] }): Promise<unknown> => {
    throw new Error("no launch set");
  },
}));
vi.mock("@vscode/test-electron", () => ({
  downloadAndUnzipVSCode: (options: { cachePath?: string }) => peers.download(options),
}));
vi.mock("playwright-core", () => ({
  _electron: {
    launch: (options: { executablePath: string; args: string[] }) => peers.launch(options),
  },
}));

const directory = mkdtempSync(join(tmpdir(), "modeler-shell-driver-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));

async function builtExtension(): Promise<string> {
  const extensionPath = join(directory, "extension");
  await mkdir(extensionPath, { recursive: true });
  await writeFile(join(extensionPath, "extension.js"), "");
  await writeFile(
    join(extensionPath, "package.json"),
    JSON.stringify({
      name: "board",
      publisher: "miragon",
      main: "./extension.js",
      contributes: {
        customEditors: [{ viewType: "board.editor", selector: [{ filenamePattern: "*.board" }] }],
      },
    }),
  );
  return extensionPath;
}

describe("runVsCodeSmoke, resolve", () => {
  it("lets two runs resolve a VS Code that is not cached yet at once, and each starts a complete install", async () => {
    const cachePath = join(directory, "cache");
    const fake = fakeTestElectron({ pauseUnpacking: true });
    const started: InstallContent[] = [];
    peers.download = fake.download;
    peers.launch = async ({ executablePath }) => {
      started.push(await readInstall(dirname(executablePath)));
      throw new Error("no VS Code in a unit test");
    };
    const lines: string[] = [];
    const options = {
      extensionPath: await builtExtension(),
      fixture: { fileName: "plan.board", text: "board" },
      parse: () => undefined,
      cachePath,
      log: (line: string) => lines.push(line),
    };

    // The second run starts while the first one is still unpacking.
    const first = runVsCodeSmoke(options);
    await fake.paused(0);
    const second = runVsCodeSmoke(options);
    await fake.paused(1);
    fake.resume(0);
    const firstResult = await first;
    fake.resume(1);
    const secondResult = await second;

    const executablePath = join(cachePath, fake.folderName, "code");
    const installOfA: InstallContent = { code: "A", app: "A", complete: true };
    expect(fake.unpacked).toEqual(["A", "B"]);
    expect(started).toEqual([installOfA, installOfA]);
    expect(await readInstall(join(cachePath, fake.folderName))).toEqual(installOfA);
    expect(await readdir(cachePath)).toEqual([fake.folderName]);
    for (const result of [firstResult, secondResult]) {
      expect(result.executablePath).toBe(executablePath);
      expect(result.failures).toEqual(["launch: no VS Code in a unit test"]);
    }
    expect(lines).toContain(
      `resolve: another run installed ${join(cachePath, fake.folderName)} first, this run uses that one`,
    );
  });
});

const OWN_WEBVIEW =
  "vscode-webview://1p2hs8aci08/index.html?id=9ea65fea&parentId=1&extensionId=miragon.board&platform=electron";
const WORKBENCH_SCRIPT =
  "vscode-file://vscode-app/opt/vscode/resources/app/out/vs/workbench/workbench.desktop.main.js";
const OTHER_BUNDLE =
  "https://file+.vscode-resource.vscode-cdn.net/opt/vscode/resources/app/extensions/markdown-language-features/media/index.js";

/** How VS Code's webview loads a file of the extension's folder. */
function resourceUrl(folder: string, relativePath: string): string {
  return `https://file+.vscode-resource.vscode-cdn.net${pathToFileURL(join(folder, relativePath)).pathname}`;
}

function thrown(message: string, url: string): Error {
  const error = new Error(message);
  error.stack = `Error: ${message}\n    at ${url}:2:31\n    at ${url}:3:1`;
  return error;
}

function consoleError(text: string, url: string) {
  return {
    type: () => "error",
    text: () => text,
    location: () => ({ url, lineNumber: 0, columnNumber: 0 }),
  };
}

interface FakeVsCodeOptions {
  /** Whether the webview shows the shell's menu. */
  menu: boolean;
  /** What the window reports once the driver first looks for the menu. */
  report?: ((window: EventEmitter) => void) | undefined;
  /** What VS Code writes into its extension host log at start. */
  extensionHostLog?: string | undefined;
}

/**
 * A VS Code window as far as the launch and the open step reach it: Playwright's `console` and
 * `pageerror` events, the workbench with the extension's webview frame, and a webview document
 * that never answers an `evaluate`.
 */
function fakeVsCode(options: FakeVsCodeOptions) {
  const window = new EventEmitter();
  let reported = false;
  const webview = {
    first: () => webview,
    contentFrame: () => webview,
    locator: () => webview,
    isVisible: async () => {
      if (!reported) {
        reported = true;
        options.report?.(window);
      }
      return options.menu;
    },
    evaluate: async () => {
      throw new Error("the fake webview has no document");
    },
  };
  Object.assign(window, {
    setDefaultTimeout: () => undefined,
    waitForSelector: async () => undefined,
    locator: () => webview,
    evaluate: async (probe: unknown) => {
      if (probe === workbenchWebviewsProbe) return [OWN_WEBVIEW];
      if (probe === activeTextEditorProbe) return false;
      return undefined;
    },
    screenshot: async ({ path }: { path: string }) => writeFile(path, ""),
  });
  const app = {
    firstWindow: async () => window,
    evaluate: async () => undefined,
    close: async () => undefined,
    process: () => ({ kill: () => true }),
  };
  peers.download = fakeTestElectron().download;
  peers.launch = async ({ args }) => {
    if (options.extensionHostLog !== undefined) {
      const userDataDir = args.find((arg) => arg.startsWith("--user-data-dir="))!.split("=")[1]!;
      const logs = join(userDataDir, "logs", "20261024T100000", "window1", "exthost");
      await mkdir(logs, { recursive: true });
      await writeFile(join(logs, "exthost.log"), options.extensionHostLog);
    }
    return app;
  };
}

async function smokeOptions(
  overrides: Partial<VsCodeSmokeOptions> = {},
): Promise<VsCodeSmokeOptions> {
  return {
    extensionPath: await builtExtension(),
    fixture: { fileName: "plan.board", text: "board" },
    parse: () => undefined,
    cachePath: join(directory, "cache-open"),
    ...overrides,
  };
}

describe("runVsCodeSmoke, open", () => {
  it(
    "fails the open step 3 s after the extension's webview threw, with the webview's errors and their stacks",
    { timeout: 30_000 },
    async () => {
      const options = await smokeOptions({
        timeoutMs: 20_000,
        screenshotDir: join(directory, "screenshots"),
      });
      // The real path, as VS Code may load the extension from it (macOS's /var is /private/var).
      const bundle = resourceUrl(realpathSync(options.extensionPath), "dist/webview.js");
      const stylesheet = resourceUrl(options.extensionPath, "dist/webview.css");
      fakeVsCode({
        menu: false,
        report: (window) => {
          window.emit(
            "console",
            consoleError(
              "%c  ERR color: #f33 Extension 'github.copilot-chat' appears in product.json",
              WORKBENCH_SCRIPT,
            ),
          );
          window.emit("pageerror", thrown("the preview cannot start", OTHER_BUNDLE));
          window.emit(
            "console",
            consoleError("Failed to load resource: net::ERR_FILE_NOT_FOUND", stylesheet),
          );
          window.emit("pageerror", thrown("board.js cannot start: no #app", bundle));
        },
      });

      const result = await runVsCodeSmoke(options);

      const screenshot = join(resolve(directory, "screenshots"), "board-open-failure.png");
      expect(result.failures).toEqual([
        [
          "open: the custom editor never showed the shell's menu, still missing 3 s after its webview threw " +
            `(1 webview frames in the workbench, 1 of miragon.board, screenshot ${screenshot}; ` +
            "keepTemporaryFiles keeps VS Code's logs); " +
            "the webview reported 1 uncaught error and 1 console error:",
          "    uncaught Error: board.js cannot start: no #app",
          `        at ${bundle}:2:31`,
          `        at ${bundle}:3:1`,
          "    console.error: Failed to load resource: net::ERR_FILE_NOT_FOUND",
          `        at ${stylesheet}:1:1`,
        ].join("\n"),
      ]);
      expect(result.timings.open).toBeGreaterThanOrEqual(3_000);
      expect(result.timings.open).toBeLessThan(10_000);
      expect(await readdir(join(directory, "screenshots"))).toEqual(["board-open-failure.png"]);
    },
  );

  it("waits the whole timeout for a webview that only logged errors, and lists them", async () => {
    const options = await smokeOptions({ timeoutMs: 1_000, keepTemporaryFiles: true });
    const bundle = resourceUrl(options.extensionPath, "dist/webview.js");
    fakeVsCode({
      menu: false,
      report: (window) =>
        window.emit(
          "console",
          consoleError(`no fixture yet Error: empty\n    at ${bundle}:7:9`, bundle),
        ),
    });
    const lines: string[] = [];

    const result = await runVsCodeSmoke({ ...options, log: (line) => lines.push(line) });

    const kept = lines.find((line) => line.startsWith("kept "))!.slice("kept ".length);
    rmSync(kept, { recursive: true, force: true });
    expect(result.failures).toEqual([
      [
        "open: the custom editor never showed the shell's menu " +
          "(1 webview frames in the workbench, 1 of miragon.board; " +
          `VS Code's logs are in ${join(kept, "user-data", "logs")}); ` +
          "the webview reported 1 console error:",
        "    console.error: no fixture yet Error: empty",
        `        at ${bundle}:7:9`,
      ].join("\n"),
    ]);
    expect(result.timings.open).toBeGreaterThanOrEqual(1_000);
  });

  it("still fails at once with VS Code's error when the extension did not activate", async () => {
    fakeVsCode({
      menu: false,
      extensionHostLog: [
        "2026-10-24 10:00:01.100 [error] Activating extension miragon.board failed due to an error:",
        "2026-10-24 10:00:01.100 [error] Error: Cannot find module './impl/format'",
      ].join("\n"),
    });

    const result = await runVsCodeSmoke(await smokeOptions({ timeoutMs: 20_000 }));

    expect(result.failures).toEqual([
      "open: the custom editor never showed the shell's menu: " +
        "Activating extension miragon.board failed due to an error: Error: Cannot find module './impl/format' " +
        "(1 webview frames in the workbench, 1 of miragon.board; keepTemporaryFiles keeps VS Code's logs)",
    ]);
    expect(result.timings.open).toBeLessThan(10_000);
  });

  it("adds the webview's errors to a failure after the menu showed", async () => {
    const options = await smokeOptions();
    const bundle = resourceUrl(options.extensionPath, "dist/webview.js");
    fakeVsCode({
      menu: true,
      report: (window) => window.emit("pageerror", thrown("importBoard: no lanes", bundle)),
    });

    const result = await runVsCodeSmoke({
      ...options,
      ready: async () => {
        throw new Error("the canvas shows no element of the fixture\nCall log: …");
      },
    });

    expect(result.failures).toEqual([
      [
        "open: the canvas shows no element of the fixture; the webview reported 1 uncaught error:",
        "    uncaught Error: importBoard: no lanes",
        `        at ${bundle}:2:31`,
        `        at ${bundle}:3:1`,
      ].join("\n"),
    ]);
  });
});
