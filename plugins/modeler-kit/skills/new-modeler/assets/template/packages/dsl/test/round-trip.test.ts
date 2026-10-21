import { describe, expect, it } from 'vitest';
import { parseText, serializeText } from '../src/index.js';

const CANONICAL =
  'title Orders\nnode order "Place \\"the\\" order" [120, 80]\n# kept\nx-vendor: keep-me\n';

describe('the text format', () => {
  it('is a fixpoint on canonical text (L2)', () => {
    expect(serializeText(parseText(CANONICAL).document)).toBe(CANONICAL);
  });

  it('canonicalises loose text once and then stays put', () => {
    const loose = '\n  node order   "Place \\"the\\" order" [ 120 ,80 ]  \ntitle Orders\n';
    const canonical = serializeText(parseText(loose).document);
    expect(canonical).toBe('title Orders\nnode order "Place \\"the\\" order" [120, 80]\n');
    expect(serializeText(parseText(canonical).document)).toBe(canonical);
  });

  it('keeps every line it cannot read (L6) and reports it', () => {
    const { document, diagnostics } = parseText('node half "typed\n');
    expect(document.passthrough).toEqual(['node half "typed']);
    expect(diagnostics).toEqual([{ line: 1, message: 'Expected node <id> "<label>" [x, y].' }]);
  });
});
