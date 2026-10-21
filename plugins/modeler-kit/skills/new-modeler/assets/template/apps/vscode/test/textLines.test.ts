import { describe, expect, it } from 'vitest';
import { minimalLineEdit } from '../src/textLines.js';

describe('minimalLineEdit', () => {
  it('touches only the changed line', () => {
    expect(minimalLineEdit('a\nb\nc\n', 'a\nB\nc\n')).toEqual({
      start: { line: 1, character: 0 },
      end: { line: 2, character: 0 },
      text: 'B\n',
    });
  });

  it('sees no change where only the line breaks differ', () => {
    expect(minimalLineEdit('a\r\nb\r\n', 'a\nb\n')).toBeUndefined();
  });
});
