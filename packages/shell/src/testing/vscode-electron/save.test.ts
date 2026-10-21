import { mkdtempSync, rmSync } from "node:fs";
import { open, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { waitForSavedText } from "./save.js";

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
async function writeInTwoSteps(file: string, first: string, rest: string, gapMs: number): Promise<void> {
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
    const file = await fixtureFile(PREVIOUS);
    let writing = true;
    const keepWriting = async () => {
      for (let index = 0; writing; index++) {
        await writeFile(file, `${SAVED}${" ".repeat(index)}`);
        await delay(2);
      }
    };
    const writer = keepWriting();
    const outcome = await waitForSavedText({
      file,
      previous: PREVIOUS,
      parse: () => 1,
      intervalMs: 40,
      settleMs: 400,
      timeoutMs: 400,
    });
    writing = false;
    await writer;
    expect(outcome.status).toBe("unsettled");
  });
});
