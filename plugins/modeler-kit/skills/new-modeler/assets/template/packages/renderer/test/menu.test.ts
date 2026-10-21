import { describe, expect, it } from 'vitest';
import { diagramMenu, diagramShortcuts } from '../src/menu/index.js';

const MESSAGES = {
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  zoomToActual: (percent: string) => `Zoom to ${percent}`,
  fit: 'Fit',
  keyNames: { ctrl: 'Ctrl', shift: 'Shift', plus: 'Plus', minus: 'Minus' },
};

describe('the diagram menu', () => {
  it('lists PNG before SVG and the shortcuts dialog under Help', () => {
    const menu = diagramMenu({
      exports: { png: { onSelect() {} }, svg: { onSelect() {} } },
      showKeyboardShortcuts() {},
    });
    expect(menu.export.map((entry) => entry.label)).toEqual(['Export as PNG', 'Export as SVG']);
    expect(menu.help.map((entry) => entry.label)).toEqual(['Keyboard shortcuts…']);
  });

  it('names Cmd on macOS and Ctrl elsewhere', () => {
    const undo = (platform: 'mac' | 'other') =>
      diagramShortcuts({ platform, lang: 'en', messages: MESSAGES })[0]?.rows[0]?.keys;
    expect(undo('mac')).toEqual(['⌘Z']);
    expect(undo('other')).toEqual(['Ctrl+Z']);
  });
});
