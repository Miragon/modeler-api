import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** What an install holds: the run that unpacked each part, and whether the marker is there. */
export interface InstallContent {
  code: string | undefined;
  app: string | undefined;
  complete: boolean;
}

export interface FakeTestElectronOptions {
  version?: string | undefined;
  /** Every unpacking waits after its first half until `resume`. */
  pauseUnpacking?: boolean | undefined;
  /** Every unpacking throws after its first half. */
  failUnpacking?: boolean | undefined;
}

interface Deferred {
  promise: Promise<void>;
  settle: () => void;
}

function deferred(): Deferred {
  let settle!: () => void;
  const promise = new Promise<void>((done) => (settle = done));
  return { promise, settle };
}

async function readPart(path: string): Promise<string | undefined> {
  return readFile(path, "utf8").catch(() => undefined);
}

export async function readInstall(folder: string): Promise<InstallContent> {
  return {
    code: await readPart(join(folder, "code")),
    app: await readPart(join(folder, "resources", "app")),
    complete: await access(join(folder, "is-complete")).then(
      () => true,
      () => false,
    ),
  };
}

/** Writes an install as one run unpacked it; without `complete`, as a download cut short. */
export async function writeInstall(folder: string, run: string, complete = true): Promise<void> {
  await mkdir(join(folder, "resources"), { recursive: true });
  await writeFile(join(folder, "code"), run);
  if (!complete) return;
  await writeFile(join(folder, "resources", "app"), run);
  await writeFile(join(folder, "is-complete"), "");
}

/**
 * `downloadAndUnzipVSCode` of `@vscode/test-electron` 3.1.0, as far as the cache goes: a version
 * folder with `is-complete` is installed; any other one it deletes and unpacks into again, `code`
 * first and `resources/app` last, then it writes the marker. Each call unpacks as the next run, "A",
 * "B", …, into the files it writes.
 */
export function fakeTestElectron(options: FakeTestElectronOptions = {}) {
  const version = options.version ?? "1.96.0";
  const folderName = `vscode-linux-x64-${version}`;
  const paused: Deferred[] = [];
  const resumed: Deferred[] = [];
  const gate = (gates: Deferred[], index: number) => (gates[index] ??= deferred());
  const unpacked: string[] = [];
  let calls = 0;

  async function download({ cachePath }: { cachePath?: string | undefined }): Promise<string> {
    if (!cachePath) throw new Error("the fake needs a cachePath");
    const index = calls++;
    const run = String.fromCharCode(65 + index);
    const folder = join(cachePath, folderName);
    const executable = join(folder, "code");
    if ((await readInstall(folder)).complete) return executable;
    unpacked.push(run);
    await rm(folder, { recursive: true, force: true });
    await mkdir(join(folder, "resources"), { recursive: true });
    await writeFile(executable, run);
    if (options.pauseUnpacking) {
      gate(paused, index).settle();
      await gate(resumed, index).promise;
    }
    if (options.failUnpacking) throw new Error(`Failed to download and unzip VS Code ${version}`);
    // tar and unzip create a missing directory, also one another run deleted meanwhile
    await mkdir(join(folder, "resources"), { recursive: true });
    await writeFile(join(folder, "resources", "app"), run);
    await writeFile(join(folder, "is-complete"), "");
    return executable;
  }

  return {
    folderName,
    download,
    /** The runs that unpacked, in order; a call that found the version installed is not in it. */
    unpacked,
    /** Resolves once the `index`-th call (from 0) has unpacked its first half. */
    paused: (index: number) => gate(paused, index).promise,
    resume: (index: number) => gate(resumed, index).settle(),
  };
}
