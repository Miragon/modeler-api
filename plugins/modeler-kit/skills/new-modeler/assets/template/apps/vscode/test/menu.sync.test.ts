import { describe, expect, it } from 'vitest';
import {
  commandKeyLabel as shellCommandKeyLabel,
  defaultMessages,
  formatPercent,
  shortcutLabel,
  type ChromeKey,
  type MenuGroups,
  type ShellHandle,
} from '@miragon/modeler-shell';
import {
  commandKeyLabel,
  diagramMenu,
  diagramShortcuts,
  type DiagramMenu,
  type ShortcutsDialogChrome,
} from '@miragon/__NOTATION__-renderer';

/*
 * The renderer builds its menu entries and shortcut rows without importing the shell (only the
 * apps mount it), so it mirrors the shell's types and key labels structurally. These tests pin
 * the mirror: a shell release that renames a field or relabels a key fails here.
 */

const VIEW_KEYS: readonly ChromeKey[] = ['zoomIn', 'zoomOut', 'zoomToActual', 'fit'];

describe('the renderer menu against @miragon/modeler-shell', () => {
  for (const platform of ['mac', 'other'] as const) {
    it(`the View rows say what the zoom panel says (${platform})`, () => {
      const view = diagramShortcuts({ platform, lang: 'en', messages: defaultMessages }).find(
        (group) => group.title === 'View',
      );
      expect(view?.rows).toEqual(
        [
          defaultMessages.zoomIn,
          defaultMessages.zoomOut,
          defaultMessages.zoomToActual(formatPercent(1, 'en')),
          defaultMessages.fit,
        ].map((action, index) => ({
          action,
          keys: [shortcutLabel(VIEW_KEYS[index]!, platform, defaultMessages.keyNames)],
        })),
      );
    });

    it(`writes Cmd/Ctrl chips as the shell does (${platform})`, () => {
      expect(commandKeyLabel('Z', platform, defaultMessages.keyNames)).toBe(
        shellCommandKeyLabel('Z', platform, defaultMessages.keyNames),
      );
    });
  }

  it('is a menu the shell takes, and a shell handle is a dialog chrome', () => {
    const menu: DiagramMenu = diagramMenu({
      exports: { png: { onSelect() {} }, svg: { onSelect() {} } },
      showKeyboardShortcuts() {},
    });
    const groups: MenuGroups = menu;
    const chrome = (shell: ShellHandle): ShortcutsDialogChrome => shell;
    expect(groups.export).toHaveLength(2);
    expect(chrome).toBeTypeOf('function');
  });
});
