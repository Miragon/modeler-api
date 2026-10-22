import { mkdtempSync, rmSync } from "node:fs";
import { chmod, mkdir, readdir, rm, stat, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { ProgressReportStage, download, type ProgressReport } from "@vscode/test-electron";
import { afterAll, describe, expect, it } from "vitest";

import { fakeTestElectron, readInstall, writeInstall } from "../../../test/support/test-electron.js";
import {
  ABANDONED_DOWNLOAD_MS,
  ABANDONED_REPLACE_MS,
  PRIVATE_DOWNLOAD_PREFIX,
  REPLACING_PREFIX,
  resolveInSharedCache,
} from "./cache.js";

const directory = mkdtempSync(join(tmpdir(), "modeler-shell-cache-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));

// root writes through any mode bits
const isRoot = process.getuid?.() === 0;

let cacheCount = 0;
async function emptyCache(): Promise<string> {
  const cachePath = join(directory, `cache-${cacheCount++}`);
  await mkdir(cachePath);
  return cachePath;
}

async function identity(path: string): Promise<string> {
  const stats = await stat(path, { bigint: true });
  return `${stats.dev}:${stats.ino}`;
}

describe("resolveInSharedCache", () => {
  it("moves a new install into the shared cache and leaves no private folder", async () => {
    const cachePath = await emptyCache();
    const fake = fakeTestElectron();

    const executable = await resolveInSharedCache({
      cachePath,
      download: (path) => fake.download({ cachePath: path }),
    });

    expect(executable).toBe(join(cachePath, fake.folderName, "code"));
    expect(await readInstall(join(cachePath, fake.folderName))).toEqual({
      code: "A",
      app: "A",
      complete: true,
    });
    expect(await readdir(cachePath)).toEqual([fake.folderName]);
  });

  it("resolves a cached version through its link: nothing unpacked, the install untouched", async () => {
    const cachePath = await emptyCache();
    const fake = fakeTestElectron();
    const install = join(cachePath, fake.folderName);
    await writeInstall(install, "earlier run");
    await writeInstall(join(cachePath, "vscode-linux-x64-1.95.0"), "older version");
    const before = await identity(install);

    const executable = await resolveInSharedCache({
      cachePath,
      download: (path) => fake.download({ cachePath: path }),
    });

    expect(executable).toBe(join(install, "code"));
    expect(fake.unpacked).toEqual([]);
    expect(await identity(install)).toBe(before);
    expect(await readInstall(install)).toEqual({ code: "earlier run", app: "earlier run", complete: true });
    expect((await readdir(cachePath)).sort()).toEqual(["vscode-linux-x64-1.95.0", fake.folderName]);
  });

  it("keeps the install another run moved in first, which that run may have started, and drops its own", async () => {
    const cachePath = await emptyCache();
    const fake = fakeTestElectron({ pauseUnpacking: true });
    const lines: string[] = [];
    const resolveOnce = () =>
      resolveInSharedCache({
        cachePath,
        download: (path) => fake.download({ cachePath: path }),
        log: (line) => lines.push(line),
      });

    const first = resolveOnce();
    await fake.paused(0);
    const second = resolveOnce();
    await fake.paused(1);
    fake.resume(1);
    const secondExecutable = await second;
    const startedBySecond = await identity(join(cachePath, fake.folderName));
    fake.resume(0);
    const firstExecutable = await first;

    expect(firstExecutable).toBe(secondExecutable);
    expect(await identity(join(cachePath, fake.folderName))).toBe(startedBySecond);
    expect(await readInstall(join(cachePath, fake.folderName))).toEqual({
      code: "B",
      app: "B",
      complete: true,
    });
    expect(await readdir(cachePath)).toEqual([fake.folderName]);
    expect(lines).toEqual([
      `another run installed ${join(cachePath, fake.folderName)} first, this run uses that one`,
    ]);
  });

  it("replaces the install @vscode/test-electron rejected, here one an older driver left unfinished", async () => {
    const cachePath = await emptyCache();
    const fake = fakeTestElectron();
    await writeInstall(join(cachePath, fake.folderName), "cut short", false);
    const lines: string[] = [];

    const executable = await resolveInSharedCache({
      cachePath,
      download: (path) => fake.download({ cachePath: path }),
      log: (line) => lines.push(line),
    });

    expect(executable).toBe(join(cachePath, fake.folderName, "code"));
    expect(fake.unpacked).toEqual(["A"]);
    expect(await readInstall(join(cachePath, fake.folderName))).toEqual({
      code: "A",
      app: "A",
      complete: true,
    });
    expect(await readdir(cachePath)).toEqual([fake.folderName]);
    expect(lines).toEqual([
      `replaced ${join(cachePath, fake.folderName)}, which @vscode/test-electron did not accept`,
    ]);
  });

  it("waits while another run moves out the rejected install, then replaces what is still there", async () => {
    const cachePath = await emptyCache();
    const fake = fakeTestElectron();
    await writeInstall(join(cachePath, fake.folderName), "cut short", false);
    const lock = join(cachePath, `${REPLACING_PREFIX}${fake.folderName}`);
    await mkdir(lock);
    let downloaded!: () => void;
    const isDownloaded = new Promise<void>((done) => (downloaded = done));
    let finished = false;

    const resolving = resolveInSharedCache({
      cachePath,
      download: async (path) => {
        const executable = await fake.download({ cachePath: path });
        downloaded();
        return executable;
      },
    }).finally(() => (finished = true));
    await isDownloaded;
    await delay(300);
    expect(finished).toBe(false);
    await rm(lock, { recursive: true });

    expect(await resolving).toBe(join(cachePath, fake.folderName, "code"));
    expect(await readInstall(join(cachePath, fake.folderName))).toEqual({
      code: "A",
      app: "A",
      complete: true,
    });
    expect(await readdir(cachePath)).toEqual([fake.folderName]);
  });

  it("takes over the lock of a run killed while it moved out a rejected install", async () => {
    const cachePath = await emptyCache();
    const fake = fakeTestElectron();
    await writeInstall(join(cachePath, fake.folderName), "cut short", false);
    const lock = join(cachePath, `${REPLACING_PREFIX}${fake.folderName}`);
    await mkdir(lock);
    const longAgo = new Date(Date.now() - ABANDONED_REPLACE_MS - 60_000);
    await utimes(lock, longAgo, longAgo);

    const executable = await resolveInSharedCache({
      cachePath,
      download: (path) => fake.download({ cachePath: path }),
    });

    expect(executable).toBe(join(cachePath, fake.folderName, "code"));
    expect(await readInstall(join(cachePath, fake.folderName))).toEqual({
      code: "A",
      app: "A",
      complete: true,
    });
    expect(await readdir(cachePath)).toEqual([fake.folderName]);
  });

  it("leaves the shared cache as it was when the download fails", async () => {
    const cachePath = await emptyCache();
    const fake = fakeTestElectron({ failUnpacking: true });
    await writeInstall(join(cachePath, "vscode-linux-x64-1.95.0"), "older version");

    await expect(
      resolveInSharedCache({ cachePath, download: (path) => fake.download({ cachePath: path }) }),
    ).rejects.toThrow("Failed to download and unzip VS Code 1.96.0");

    expect(await readdir(cachePath)).toEqual(["vscode-linux-x64-1.95.0"]);
    expect(await readInstall(join(cachePath, "vscode-linux-x64-1.95.0"))).toEqual({
      code: "older version",
      app: "older version",
      complete: true,
    });
  });

  it("removes the private folder of a run killed more than a day ago, not the one of a run in progress", async () => {
    const cachePath = await emptyCache();
    const fake = fakeTestElectron();
    const killed = join(cachePath, `${PRIVATE_DOWNLOAD_PREFIX}killed`);
    const inProgress = join(cachePath, `${PRIVATE_DOWNLOAD_PREFIX}in-progress`);
    await writeInstall(join(killed, fake.folderName), "killed", false);
    await writeInstall(join(inProgress, fake.folderName), "in progress", false);
    const longAgo = new Date(Date.now() - ABANDONED_DOWNLOAD_MS - 60_000);
    await utimes(killed, longAgo, longAgo);

    await resolveInSharedCache({ cachePath, download: (path) => fake.download({ cachePath: path }) });

    expect((await readdir(cachePath)).sort()).toEqual([
      `${PRIVATE_DOWNLOAD_PREFIX}in-progress`,
      fake.folderName,
    ]);
  });

  it.skipIf(isRoot)("reads a cache it cannot write to as it is", async () => {
    const cachePath = await emptyCache();
    const fake = fakeTestElectron();
    await writeInstall(join(cachePath, fake.folderName), "earlier run");
    const cachePaths: string[] = [];
    await chmod(cachePath, 0o555);
    try {
      const executable = await resolveInSharedCache({
        cachePath,
        download: (path) => {
          cachePaths.push(path);
          return fake.download({ cachePath: path });
        },
      });

      expect(executable).toBe(join(cachePath, fake.folderName, "code"));
      expect(cachePaths).toEqual([cachePath]);
      expect(fake.unpacked).toEqual([]);
    } finally {
      await chmod(cachePath, 0o755);
    }
  });

  it.skipIf(isRoot)(
    "retries a move the file system refuses for a moment, as Windows does while a virus scanner holds a file",
    async () => {
      const cachePath = await emptyCache();
      const fake = fakeTestElectron();
      let writableAgain: Promise<void> | undefined;
      try {
        const executable = await resolveInSharedCache({
          cachePath,
          download: async (path) => {
            const unpacked = await fake.download({ cachePath: path });
            await chmod(cachePath, 0o555);
            writableAgain = delay(150).then(() => chmod(cachePath, 0o755));
            return unpacked;
          },
        });

        expect(executable).toBe(join(cachePath, fake.folderName, "code"));
        expect(await readInstall(join(cachePath, fake.folderName))).toEqual({
          code: "A",
          app: "A",
          complete: true,
        });
        expect(await readdir(cachePath)).toEqual([fake.folderName]);
      } finally {
        await writableAgain;
        await chmod(cachePath, 0o755);
      }
    },
  );

  it.skipIf(isRoot)(
    "returns the VS Code when its private folder cannot be removed, which a later run removes",
    async () => {
      const cachePath = await emptyCache();
      const fake = fakeTestElectron();
      let locked = "";
      try {
        const executable = await resolveInSharedCache({
          cachePath,
          download: async (path) => {
            locked = join(path, "locked");
            await mkdir(locked);
            await writeFile(join(locked, "in-use"), "");
            await chmod(locked, 0o555);
            return fake.download({ cachePath: path });
          },
        });

        expect(executable).toBe(join(cachePath, fake.folderName, "code"));
        expect(await readInstall(join(cachePath, fake.folderName))).toEqual({
          code: "A",
          app: "A",
          complete: true,
        });
        expect((await readdir(cachePath)).sort()).toEqual([basename(dirname(locked)), fake.folderName]);
      } finally {
        if (locked) await chmod(locked, 0o755);
      }
    },
  );

  it("does not link an entry of the cache it cannot read, here a link to itself, and resolves as without it", async () => {
    const cachePath = await emptyCache();
    const fake = fakeTestElectron();
    const unreadable = "vscode-linux-x64-1.95.0";
    await symlink(unreadable, join(cachePath, unreadable));

    const executable = await resolveInSharedCache({
      cachePath,
      download: (path) => fake.download({ cachePath: path }),
    });

    expect(executable).toBe(join(cachePath, fake.folderName, "code"));
    expect(fake.unpacked).toEqual(["A"]);
    expect((await readdir(cachePath)).sort()).toEqual([unreadable, fake.folderName]);
  });

  it("returns an executable outside the private folder as it is and moves nothing", async () => {
    const cachePath = await emptyCache();
    const elsewhere = join(directory, "installed", "code");

    expect(await resolveInSharedCache({ cachePath, download: async () => elsewhere })).toBe(elsewhere);
    expect(await readdir(cachePath)).toEqual([]);
  });
});

describe("resolveInSharedCache with @vscode/test-electron 3.1.0", () => {
  const folderName = "vscode-linux-x64-1.96.0";
  /** Fails a download before it reaches the network. */
  function offlineReporter(stages: string[]) {
    return {
      report(report: ProgressReport) {
        stages.push(report.stage);
        if (report.stage === ProgressReportStage.ResolvingCDNLocation) throw new Error("offline");
      },
      error() {},
    };
  }
  const realDownload = (stages: string[]) => (cachePath: string) =>
    download({ version: "1.96.0", platform: "linux-x64", cachePath, reporter: offlineReporter(stages) });

  it("finds a cached version through the link", async () => {
    const cachePath = await emptyCache();
    await writeInstall(join(cachePath, folderName), "earlier run");
    const stages: string[] = [];

    const executable = await resolveInSharedCache({ cachePath, download: realDownload(stages) });

    expect(executable).toBe(join(cachePath, folderName, "code"));
    expect(stages).toEqual([ProgressReportStage.ResolvedVersion, ProgressReportStage.FoundMatchingInstall]);
    expect(await readdir(cachePath)).toEqual([folderName]);
  });

  it("deletes the link of an unfinished install, never the install", async () => {
    const cachePath = await emptyCache();
    await writeInstall(join(cachePath, folderName), "cut short", false);
    const stages: string[] = [];

    await expect(resolveInSharedCache({ cachePath, download: realDownload(stages) })).rejects.toThrow(
      "Failed to download and unzip VS Code 1.96.0",
    );

    expect(stages).toContain(ProgressReportStage.ResolvingCDNLocation);
    expect(await readInstall(join(cachePath, folderName))).toEqual({
      code: "cut short",
      app: undefined,
      complete: false,
    });
    expect(await readdir(cachePath)).toEqual([folderName]);
  });
});
