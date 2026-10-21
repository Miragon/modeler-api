import { describe, expect, it } from 'vitest';
import { createEmptyDocument, validateDocument } from '../src/index.js';

describe('validateDocument', () => {
  it('accepts the empty document', () => {
    expect(validateDocument(createEmptyDocument('Untitled'))).toEqual({
      title: 'Untitled',
      nodes: [],
      passthrough: [],
    });
  });

  it('keeps fields it does not know (L6: foreign content survives)', () => {
    const document = { nodes: [{ id: 'a', label: 'A', x: 0, y: 0, owner: 'x' }], passthrough: [] };
    expect(validateDocument(document).nodes[0]).toMatchObject({ owner: 'x' });
  });

  it('refuses two elements with the same id', () => {
    const node = { id: 'a', label: 'A', x: 0, y: 0 };
    expect(() => validateDocument({ nodes: [node, node], passthrough: [] })).toThrow(
      'Duplicate element id "a".',
    );
  });
});
