import { mkdtempSync, rmSync } from "node:fs";
import { open, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { readSaveOnceClean, waitForSavedText } from "./save.js";

const directory = mkdtempSync(join(tmpdir(), "modeler-shell-save-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));

let fileCount = 0;
async function fixtureFile(text: string): Promise<string> {
  const file = join(directory, `board-${fileCount++}.json`);
  await writeFile(file, text);
  return file;
}

const delay = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

const PREVIOUS = JSON.stringify({ elements: ["a"] });
const SAVED = JSON.stringify({ elements: ["a", "b"], edges: [{ from: "a", to: "b" }] });

/** As VS Code saves: truncate, write the first part, and only `gapMs` later the rest. */
async function writeInTwoSteps(
  file: string,
  first: string,
  rest: string,
  gapMs: number,
): Promise<void> {
  const handle = await open(file, "w");
  try {
    if (first) await handle.write(first);
    await delay(gapMs);
    await handle.write(rest);
  } finally {
    await handle.close();
  }
}

function recordingParse(): { parse: (text: string) => unknown; texts: string[] } {
  const texts: string[] = [];
  return {
    texts,
    parse(text) {
      texts.push(text);
      return JSON.parse(text) as unknown;
    },
  };
}

const fast = { intervalMs: 20, settleMs: 400, timeoutMs: 5_000 };

// A line-based DSL, the kind the Wardley and Event Storming modelers save: every whole-line prefix parses.
const MAP = "title Tea\ncomponent A [0.5, 0.5]\ncomponent B [0.4, 0.3]\nA -> B\n";
const MAP_FIRST_PART = MAP.slice(0, MAP.indexOf("component B"));
function lineParse(): { parse: (text: string) => string[]; texts: string[] } {
  const texts: string[] = [];
  return {
    texts,
    parse(text) {
      texts.push(text);
      return text.split("\n").filter(Boolean);
    },
  };
}

describe("waitForSavedText", () => {
  it("parses the complete text of a file written in two steps, not its first part", async () => {
    const file = await fixtureFile(PREVIOUS);
    const { parse, texts } = recordingParse();
    const half = SAVED.slice(0, 20);
    const [outcome] = await Promise.all([
      waitForSavedText({ file, previous: PREVIOUS, parse, ...fast }),
      writeInTwoSteps(file, half, SAVED.slice(20), 200),
    ]);
    expect(outcome).toMatchObject({ status: "parsed", text: SAVED, parsed: JSON.parse(SAVED) });
    // the first part held still long enough to be parsed, and its rejection was not the end
    expect(texts).toContain(half);
    expect(texts.at(-1)).toBe(SAVED);
  });

  it("reads past the empty file between VS Code's truncate and its write", async () => {
    const file = await fixtureFile(PREVIOUS);
    const { parse, texts } = recordingParse();
    const [outcome] = await Promise.all([
      waitForSavedText({ file, previous: PREVIOUS, parse, ...fast }),
      writeInTwoSteps(file, "", SAVED, 200),
    ]);
    expect(outcome).toMatchObject({ status: "parsed", text: SAVED });
    expect(texts).toContain("");
  });

  it("reports a file that still holds the previous text as unchanged, without parsing it", async () => {
    const file = await fixtureFile(PREVIOUS);
    const texts: string[] = [];
    const outcome = await waitForSavedText({
      file,
      previous: PREVIOUS,
      parse: (text) => texts.push(text),
      ...fast,
      timeoutMs: 200,
    });
    expect(outcome).toEqual({ status: "unchanged" });
    expect(texts).toEqual([]);
  });

  it("parses a text only once a second read, intervalMs later, saw it unchanged", async () => {
    const file = await fixtureFile(SAVED);
    const texts: string[] = [];
    const started = performance.now();
    const outcome = await waitForSavedText({
      file,
      previous: PREVIOUS,
      parse: (text) => texts.push(text),
      ...fast,
      intervalMs: 150,
    });
    expect(outcome.status).toBe("parsed");
    expect(performance.now() - started).toBeGreaterThanOrEqual(140);
    expect(texts).toEqual([SAVED]);
  });

  it("reads a file that the save replaced, removed and created again", async () => {
    const file = await fixtureFile(PREVIOUS);
    const { parse } = recordingParse();
    const replace = async () => {
      await rm(file);
      await delay(100);
      await writeFile(file, SAVED);
    };
    const [outcome] = await Promise.all([
      waitForSavedText({ file, previous: PREVIOUS, parse, ...fast }),
      replace(),
    ]);
    expect(outcome).toMatchObject({ status: "parsed", text: SAVED });
  });

  it("gives up on a text the parser keeps rejecting once it stayed unchanged for settleMs", async () => {
    const file = await fixtureFile(PREVIOUS);
    await writeFile(file, '{"elements": [');
    const started = performance.now();
    const outcome = await waitForSavedText({
      file,
      previous: PREVIOUS,
      parse: (text) => JSON.parse(text) as unknown,
      ...fast,
    });
    const waited = performance.now() - started;
    expect(outcome).toMatchObject({ status: "unparseable", text: '{"elements": [' });
    if (outcome.status !== "unparseable") return;
    expect(outcome.error).toBeInstanceOf(SyntaxError);
    expect(outcome.unchangedMs).toBeGreaterThanOrEqual(fast.settleMs);
    expect(waited).toBeLessThan(fast.timeoutMs);
  });

  it("reports a rejected text at the timeout even before settleMs", async () => {
    const file = await fixtureFile(PREVIOUS);
    await writeFile(file, "not json");
    const outcome = await waitForSavedText({
      file,
      previous: PREVIOUS,
      parse: (text) => JSON.parse(text) as unknown,
      intervalMs: 20,
      settleMs: 10_000,
      timeoutMs: 300,
    });
    expect(outcome).toMatchObject({ status: "unparseable", text: "not json" });
  });

  it("accepts a parser that resolves asynchronously", async () => {
    const file = await fixtureFile(SAVED);
    const outcome = await waitForSavedText({
      file,
      previous: PREVIOUS,
      parse: async (text) => {
        await delay(5);
        return text.length;
      },
      ...fast,
    });
    expect(outcome).toMatchObject({ status: "parsed", parsed: SAVED.length });
  });

  it("reports a file that never holds still as unsettled", async () => {
    // every read sees a newer write, whatever the runner's timing: no two reads ever match
    let writes = 0;
    const outcome = await waitForSavedText({
      file: "board.json",
      previous: PREVIOUS,
      parse: () => 1,
      intervalMs: 1,
      settleMs: 50,
      timeoutMs: 50,
      readSample: async () => {
        writes++;
        const text = `${SAVED}${" ".repeat(writes)}`;
        return { text, size: text.length, mtimeMs: writes, consistent: true };
      },
    });
    expect(outcome.status).toBe("unsettled");
    expect(writes).toBeGreaterThan(1);
  });
});

describe("readSaveOnceClean", () => {
  it("documents why: on its own, the hold-still check takes a pause inside the write for its end", async () => {
    const file = await fixtureFile("title Tea\n");
    const { parse } = lineParse();
    const [outcome] = await Promise.all([
      waitForSavedText({ file, previous: "title Tea\n", parse, ...fast }),
      writeInTwoSteps(file, MAP_FIRST_PART, MAP.slice(MAP_FIRST_PART.length), 400),
    ]);
    expect(outcome).toMatchObject({ status: "parsed", text: MAP_FIRST_PART });
  });

  it("reads the disk only once the editor turned clean, so a pause inside the write is not its end", async () => {
    const file = await fixtureFile("title Tea\n");
    const { parse, texts } = lineParse();
    let writing = true;
    let cleanAt = Number.POSITIVE_INFINITY;
    const parsedAt: number[] = [];
    const dirtyChecks: boolean[] = [];
    const save = async () => {
      await writeInTwoSteps(file, MAP_FIRST_PART, MAP.slice(MAP_FIRST_PART.length), 400);
      writing = false;
    };
    const [result] = await Promise.all([
      readSaveOnceClean({
        file,
        previous: "title Tea\n",
        parse: (text) => {
          parsedAt.push(performance.now());
          return parse(text);
        },
        dirty: async () => {
          dirtyChecks.push(writing);
          if (!writing) cleanAt = Math.min(cleanAt, performance.now());
          return writing;
        },
        ...fast,
      }),
      save(),
    ]);
    expect(result).toMatchObject({ clean: true, diskTimeoutMs: fast.timeoutMs });
    expect(result.written).toMatchObject({ status: "parsed", text: MAP });
    expect(texts).toEqual([MAP]);
    expect(parsedAt.every((at) => at >= cleanAt)).toBe(true);
    expect(dirtyChecks.at(0)).toBe(true);
    expect(dirtyChecks.at(-1)).toBe(false);
  });

  it("gives the disk settleMs, not another timeout, when the editor stays dirty", async () => {
    const file = await fixtureFile(PREVIOUS);
    const started = performance.now();
    const result = await readSaveOnceClean({
      file,
      previous: PREVIOUS,
      parse: (text) => JSON.parse(text) as unknown,
      dirty: async () => true,
      intervalMs: 20,
      settleMs: 200,
      timeoutMs: 300,
    });
    expect(result).toEqual({ clean: false, diskTimeoutMs: 200, written: { status: "unchanged" } });
    expect(performance.now() - started).toBeLessThan(300 + 200 + 400);
  });
});
