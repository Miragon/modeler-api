import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { fakeTestElectron, readInstall, writeInstall } from "../../../test/support/test-electron.js";
import { resolveInSharedCache } from "./cache.js";

const fileSystem = vi.hoisted(() => ({
  heldStat: undefined as { path: string; reached: () => void; release: Promise<void> } | undefined,
  watched: undefined as string | undefined,
  movedOutOfWatched: [] as string[],
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const fs = await importOriginal<typeof import("node:fs/promises")>();
  const identityOf = async (path: string) =>
    fs.stat(path, { bigint: true }).then(
      (stats) => `${stats.dev}:${stats.ino}`,
      () => undefined,
    );
  return {
    ...fs,
    stat: async (...args: Parameters<typeof fs.stat>) => {
      const stats = await fs.stat(...args);
      const held = fileSystem.heldStat;
      if (held && args[0] === held.path) {
        fileSystem.heldStat = undefined;
        held.reached();
        await held.release;
      }
      return stats;
    },
    rename: async (from: string, to: string) => {
      if (from === fileSystem.watched) {
        const identity = await identityOf(from);
        if (identity) fileSystem.movedOutOfWatched.push(identity);
      }
      return fs.rename(from, to);
    },
  };
});

/** Holds the next `stat` of `path` once its result is read, until `release`. */
function holdNextStat(path: string) {
  let reached!: () => void;
  let release!: () => void;
  const isReached = new Promise<void>((done) => (reached = done));
  fileSystem.heldStat = { path, reached, release: new Promise<void>((done) => (release = done)) };
  return { reached: isReached, release };
}

const directory = mkdtempSync(join(tmpdir(), "modeler-shell-cache-fs-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));
afterEach(() => {
  fileSystem.heldStat = undefined;
  fileSystem.watched = undefined;
  fileSystem.movedOutOfWatched = [];
});

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

describe("resolveInSharedCache on a file system the test controls", () => {
  it("never moves out the install a run put in place of a rejected one, also for a run that saw the rejected one", async () => {
    const cachePath = await emptyCache();
    const fake = fakeTestElectron({ pauseUnpacking: true });
    const shared = join(cachePath, fake.folderName);
    await writeInstall(shared, "cut short", false);
    const rejected = await identity(shared);
    const lines: [string[], string[]] = [[], []];
    const resolveAs = (run: 0 | 1) =>
      resolveInSharedCache({
        cachePath,
        download: (path) => fake.download({ cachePath: path }),
        log: (line) => lines[run].push(line),
      });

    const first = resolveAs(0);
    await fake.paused(0);
    const second = resolveAs(1);
    await fake.paused(1);
    fileSystem.watched = shared;
    // The first run finds the rejected install in its way and waits right after it looked at it.
    const firstLooked = holdNextStat(shared);
    fake.resume(0);
    await firstLooked.reached;
    fake.resume(1);
    const secondExecutable = await second;
    const startedBySecond = await identity(shared);
    firstLooked.release();
    const firstExecutable = await first;

    expect(fileSystem.movedOutOfWatched).toEqual([rejected]);
    expect(await identity(shared)).toBe(startedBySecond);
    expect(await readInstall(shared)).toEqual({ code: "B", app: "B", complete: true });
    expect(firstExecutable).toBe(secondExecutable);
    expect(await readdir(cachePath)).toEqual([fake.folderName]);
    expect(lines).toEqual([
      [`another run installed ${shared} first, this run uses that one`],
      [`replaced ${shared}, which @vscode/test-electron did not accept`],
    ]);
  });
});
