/** A zero-based document position, independent of the `vscode` runtime (unit-testable). */
export interface LinePosition {
  line: number;
  character: number;
}

export interface LineEdit {
  start: LinePosition;
  end: LinePosition;
  text: string;
}

export function splitLines(text: string): string[] {
  return text.split(/\r\n|\n/);
}

/**
 * The smallest whole-line edit that turns `oldText` into `newText`: common leading and trailing
 * lines stay untouched, so a side-by-side text editor keeps its cursor and scroll position, and
 * every canvas change is one small undo step of the document. Undefined when only the line breaks
 * differ.
 */
export function minimalLineEdit(oldText: string, newText: string): LineEdit | undefined {
  const oldLines = splitLines(oldText);
  const newLines = splitLines(newText);
  const shorter = Math.min(oldLines.length, newLines.length);
  let prefix = 0;
  while (prefix < shorter && oldLines[prefix] === newLines[prefix]) prefix++;
  if (prefix === oldLines.length && prefix === newLines.length) return undefined;
  let suffix = 0;
  while (
    suffix < shorter - prefix &&
    oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]
  ) {
    suffix++;
  }
  const inserted = newLines.slice(prefix, newLines.length - suffix);
  if (suffix > 0) {
    return {
      start: { line: prefix, character: 0 },
      end: { line: oldLines.length - suffix, character: 0 },
      text: inserted.map((line) => `${line}\n`).join(''),
    };
  }
  // The change reaches the last line, which has no line break of its own: anchor at the end of the
  // previous line, so removed or added lines take their preceding break with them.
  const lastLine = oldLines.length - 1;
  const end = { line: lastLine, character: oldLines[lastLine]!.length };
  if (prefix === 0) return { start: { line: 0, character: 0 }, end, text: inserted.join('\n') };
  return {
    start: { line: prefix - 1, character: oldLines[prefix - 1]!.length },
    end,
    text: inserted.map((line) => `\n${line}`).join(''),
  };
}
