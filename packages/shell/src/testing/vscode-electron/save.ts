import { readFile, stat } from "node:fs/promises";

/** One read of the file between two `stat` calls. */
interface FileSample {
  text: string;
  size: number;
  mtimeMs: number;
  /** Size and mtime did not change while the file was read, and the read got every byte. */
  consistent: boolean;
}

export interface SavedTextOptions<T> {
  file: string;
  /** The text before the save: a read that still shows it is not the save's. */
  previous: string;
  parse: (text: string) => T | Promise<T>;
  /** How long the file may take to change and settle. */
  timeoutMs: number;
  /** Between two reads; default 100 ms. */
  intervalMs?: number | undefined;
  /** How long a text the parser rejects has to stay unchanged before it counts as the saved one; default 1 s. */
  settleMs?: number | undefined;
}

/**
 * What the save left on disk: `parsed`, or why not. `unchanged`: the file still holds `previous`.
 * `unsettled`: it changed but never held still for two reads. `unparseable`: it held still and
 * the parser rejected it for `settleMs`.
 */
export type SavedTextOutcome<T> =
  | { status: "parsed"; text: string; parsed: T; waitedMs: number }
  | { status: "unchanged" }
  | { status: "unsettled"; text: string | undefined }
  | { status: "unparseable"; text: string; error: unknown; unchangedMs: number };

const DEFAULT_INTERVAL_MS = 100;
const DEFAULT_SETTLE_MS = 1_000;

const delay = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

async function sampleFile(path: string): Promise<FileSample | undefined> {
  try {
    const before = await stat(path);
    const bytes = await readFile(path);
    const after = await stat(path);
    return {
      text: bytes.toString("utf8"),
      size: after.size,
      mtimeMs: after.mtimeMs,
      consistent:
        before.size === after.size && before.mtimeMs === after.mtimeMs && bytes.length === after.size,
    };
  } catch {
    // between the removal and the creation of a file that is written by replacing it
    return undefined;
  }
}

function sameSample(a: FileSample | undefined, b: FileSample | undefined): a is FileSample {
  return (
    a !== undefined &&
    b !== undefined &&
    a.consistent &&
    b.consistent &&
    a.size === b.size &&
    a.mtimeMs === b.mtimeMs &&
    a.text === b.text
  );
}

/**
 * Reads the file a save writes until it holds still, then parses it. VS Code truncates a file
 * before it writes the new text, so a single read after the save key can see nothing or the first
 * part. A read counts once two reads `intervalMs` apart see the same size, mtime and text, and the
 * text differs from `previous`. A text the parser rejects is read again: only when it stays
 * unchanged for `settleMs` is it the saved one.
 */
export async function waitForSavedText<T>(options: SavedTextOptions<T>): Promise<SavedTextOutcome<T>> {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const settleMs = options.settleMs ?? DEFAULT_SETTLE_MS;
  const started = performance.now();
  const deadline = started + options.timeoutMs;
  let changed = false;
  let latest: FileSample | undefined;
  let rejected: { text: string; error: unknown; since: number } | undefined;
  for (;;) {
    const sample = await sampleFile(options.file);
    if (sample && sample.text !== options.previous) changed = true;
    const now = performance.now();
    if (sameSample(sample, latest) && sample.text !== options.previous) {
      if (rejected?.text === sample.text) {
        if (now - rejected.since >= settleMs) {
          return {
            status: "unparseable",
            text: sample.text,
            error: rejected.error,
            unchangedMs: Math.round(now - rejected.since),
          };
        }
      } else {
        try {
          const parsed = await options.parse(sample.text);
          return {
            status: "parsed",
            text: sample.text,
            parsed,
            waitedMs: Math.round(performance.now() - started),
          };
        } catch (error) {
          rejected = { text: sample.text, error, since: now };
        }
      }
    }
    if (performance.now() >= deadline) {
      if (!changed) return { status: "unchanged" };
      if (rejected && rejected.text === sample?.text) {
        return {
          status: "unparseable",
          text: rejected.text,
          error: rejected.error,
          unchangedMs: Math.round(now - rejected.since),
        };
      }
      return { status: "unsettled", text: sample?.text ?? latest?.text };
    }
    latest = sample;
    await delay(intervalMs);
  }
}
