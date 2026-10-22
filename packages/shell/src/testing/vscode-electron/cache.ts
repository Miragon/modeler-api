import { rmSync } from "node:fs";
import { lstat, mkdir, mkdtemp, readdir, rename, rm, stat, symlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

/** Names a run's private download folder inside the shared cache. */
export const PRIVATE_DOWNLOAD_PREFIX = ".download-";

/**
 * How old the private download folder of a run that never removed it (killed mid-download) has to
 * be before another run removes it: far longer than a download takes.
 */
export const ABANDONED_DOWNLOAD_MS = 24 * 60 * 60 * 1000;

/** Names the lock a run holds while it moves a rejected install out of the shared cache. */
export const REPLACING_PREFIX = ".replacing-";

/**
 * How old the lock of a run that never removed it (killed while it moved an install) has to be
 * before another run takes it over: far longer than the check and the rename it guards take.
 */
export const ABANDONED_REPLACE_MS = 60 * 1000;

const PUBLISH_ATTEMPTS = 10;
const PUBLISH_RETRY_MS = 100;
const REPLACE_POLL_MS = 50;

export interface SharedCacheOptions {
  /** The cache every run on the machine shares. */
  cachePath: string;
  /** `@vscode/test-electron`'s download into the cache it is given; resolves with the executable. */
  download: (cachePath: string) => Promise<string>;
  log?: ((line: string) => void) | undefined;
}

/**
 * Resolves VS Code in a cache that concurrent runs share, with no lock around the download.
 * `@vscode/test-electron` deletes a version folder without its completion marker and unpacks into it
 * again, so two runs on one folder delete and overwrite each other's install. `download` therefore
 * gets a private folder inside `cachePath` that links every install of the shared cache: a cached
 * version resolves through its link, a new one is unpacked there and moved into the shared cache
 * with one rename. The shared cache only ever gains complete installs. Returns the executable in
 * the shared cache.
 */
export async function resolveInSharedCache({
  cachePath,
  download,
  log = () => undefined,
}: SharedCacheOptions): Promise<string> {
  await mkdir(cachePath, { recursive: true });
  await removeAbandonedDownloads(cachePath);
  const privateCache = await mkdtemp(join(cachePath, PRIVATE_DOWNLOAD_PREFIX)).catch((error: unknown) => {
    // A cache this run cannot write to, it cannot break for another run either.
    if (isReadOnly(error)) return undefined;
    throw error;
  });
  if (!privateCache) return download(cachePath);
  // process.exit skips `finally`; a killed run leaves its folder to removeAbandonedDownloads.
  const removePrivateCacheNow = () => rmSync(privateCache, { recursive: true, force: true, maxRetries: 3 });
  process.once("exit", removePrivateCacheNow);
  try {
    const linked = await linkSharedInstalls(cachePath, privateCache).catch((error: unknown) => {
      if (!cannotLink(error)) throw error;
      log(
        `${cachePath} cannot hold links (${String(codeOf(error))}), so this run uses it directly, unprotected from runs at the same time`,
      );
      return undefined;
    });
    if (!linked) return await download(cachePath);
    const executable = await download(privateCache);
    const inside = relative(privateCache, executable);
    if (inside === "" || inside === ".." || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
      return executable;
    }
    const folder = inside.split(sep)[0]!;
    const unpacked = join(privateCache, folder);
    if (!(await lstat(unpacked)).isSymbolicLink()) {
      await publish(unpacked, join(cachePath, folder), linked.get(folder), log);
    }
    return join(cachePath, inside);
  } finally {
    process.off("exit", removePrivateCacheNow);
    // What is left goes with removeAbandonedDownloads; it must not fail a run that has its VS Code.
    await rm(privateCache, { recursive: true, force: true, maxRetries: 3 }).catch(() => undefined);
  }
}

async function removeAbandonedDownloads(cachePath: string): Promise<void> {
  const now = Date.now();
  for (const name of await readdir(cachePath)) {
    if (!name.startsWith(PRIVATE_DOWNLOAD_PREFIX)) continue;
    const folder = join(cachePath, name);
    const modified = await lstat(folder).then(
      (stats) => stats.mtimeMs,
      () => now,
    );
    // Two runs may remove the same folder at once; the one that loses has nothing left to do.
    if (now - modified > ABANDONED_DOWNLOAD_MS) {
      await rm(folder, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

/** Links every install of the shared cache into the private one; returns their identities by name. */
async function linkSharedInstalls(cachePath: string, privateCache: string): Promise<Map<string, string>> {
  const identities = new Map<string, string>();
  for (const name of await readdir(cachePath)) {
    if (name.startsWith(".")) continue;
    const install = join(cachePath, name);
    const identity = await identityOf(install).catch(() => undefined);
    if (!identity) continue;
    // A junction needs no privilege on Windows; elsewhere the type is ignored.
    await symlink(install, join(privateCache, name), "junction");
    identities.set(name, identity);
  }
  return identities;
}

/**
 * Moves `unpacked` to `shared`. An install another run moved there first stays: it is complete, and
 * that run may have started it already. Only the install `@vscode/test-electron` rejected through
 * this run's link (an outdated Insiders build, a download an older driver left unfinished) is
 * replaced.
 */
async function publish(
  unpacked: string,
  shared: string,
  rejected: string | undefined,
  log: (line: string) => void,
): Promise<void> {
  let replaced = false;
  for (let attempt = 1; ; attempt++) {
    try {
      await rename(unpacked, shared);
      if (replaced) log(`replaced ${shared}, which @vscode/test-electron did not accept`);
      return;
    } catch (error) {
      if (attempt >= PUBLISH_ATTEMPTS || !isOccupied(error)) throw error;
    }
    const current = await identityOf(shared);
    if (current === undefined) {
      // Windows refuses the rename while a virus scanner still holds a file of the new install.
      await delay(PUBLISH_RETRY_MS * attempt);
      continue;
    }
    if (current !== rejected) {
      log(`another run installed ${shared} first, this run uses that one`);
      return;
    }
    if (await moveAsideWhileRejected(shared, rejected, `${unpacked}.rejected-${attempt}`)) replaced = true;
  }
}

/**
 * Moves the rejected install at `shared` to `aside`, unless it is no longer there. Runs that found
 * the same rejected install take turns: one that looked just before another one replaced it would
 * otherwise move out the new install, which that run may have started already.
 */
async function moveAsideWhileRejected(shared: string, rejected: string, aside: string): Promise<boolean> {
  const lock = join(dirname(shared), `${REPLACING_PREFIX}${basename(shared)}`);
  await takeLock(lock);
  try {
    if ((await identityOf(shared)) !== rejected) return false;
    await rename(shared, aside);
    return true;
  } catch (error) {
    if (codeOf(error) === "ENOENT") return false;
    throw error;
  } finally {
    // A lock left behind only holds up the next replace until it counts as abandoned.
    await rm(lock, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function takeLock(lock: string): Promise<void> {
  for (;;) {
    try {
      await mkdir(lock);
      return;
    } catch (error) {
      if (codeOf(error) !== "EEXIST") throw error;
    }
    const age = await lstat(lock).then(
      (stats) => Date.now() - stats.mtimeMs,
      () => undefined,
    );
    if (age === undefined) continue;
    if (age > ABANDONED_REPLACE_MS) await rm(lock, { recursive: true, force: true });
    else await delay(REPLACE_POLL_MS);
  }
}

/** A directory's identity, which a rename keeps; undefined when there is no directory. */
async function identityOf(path: string): Promise<string | undefined> {
  try {
    const stats = await stat(path, { bigint: true });
    return stats.isDirectory() ? `${stats.dev}:${stats.ino}:${stats.birthtimeNs}` : undefined;
  } catch (error) {
    if (codeOf(error) === "ENOENT") return undefined;
    throw error;
  }
}

function codeOf(error: unknown): unknown {
  return error instanceof Error && "code" in error ? error.code : undefined;
}

function isReadOnly(error: unknown): boolean {
  const code = codeOf(error);
  return code === "EACCES" || code === "EPERM" || code === "EROFS";
}

/** A file system without symbolic links: EPERM on Linux (FAT), ENOTSUP, EOPNOTSUPP or ENOSYS elsewhere. */
function cannotLink(error: unknown): boolean {
  const code = codeOf(error);
  return code === "EPERM" || code === "ENOTSUP" || code === "EOPNOTSUPP" || code === "ENOSYS";
}

/** A rename onto a directory that is there already: ENOTEMPTY or EEXIST, on Windows EPERM or EACCES. */
function isOccupied(error: unknown): boolean {
  const code = codeOf(error);
  return code === "ENOTEMPTY" || code === "EEXIST" || code === "EPERM" || code === "EACCES";
}
