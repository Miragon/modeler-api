import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";

import {
  fakeTestElectron,
  readInstall,
  type InstallContent,
} from "../../../test/support/test-electron.js";
import { runVsCodeSmoke } from "./driver.js";

const peers = vi.hoisted(() => ({
  download: (_options: { cachePath?: string | undefined }): Promise<string> => {
    throw new Error("no download set");
  },
  launch: (_options: { executablePath: string }): Promise<never> => {
    throw new Error("no launch set");
  },
}));
vi.mock("@vscode/test-electron", () => ({
  downloadAndUnzipVSCode: (options: { cachePath?: string }) => peers.download(options),
}));
vi.mock("playwright-core", () => ({
  _electron: { launch: (options: { executablePath: string }) => peers.launch(options) },
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
