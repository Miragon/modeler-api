import { afterEach, describe, expect, it } from 'vitest';
import {
  SHORTCUTS_KEY,
  createShortcutsDialog,
  type ShortcutsDialog,
  type ShortcutsDialogChrome,
  type ShortcutsDialogOptions,
} from '../../src/index.js';

const SVG = 'http://www.w3.org/2000/svg';

interface Page {
  readonly chrome: ShortcutsDialogChrome;
  readonly dialog: ShortcutsDialog;
  readonly canvas: SVGSVGElement;
  readonly trigger: HTMLButtonElement;
  readonly menuEntry: HTMLButtonElement;
  menuOpen: boolean;
  startScreen: boolean;
}

const mounted: Array<{ root: HTMLElement; dialog: ShortcutsDialog }> = [];

afterEach(() => {
  for (const { root, dialog } of mounted.splice(0)) {
    dialog.destroy();
    root.remove();
  }
});

/** A chrome as the shell's handle gives it: a menu with its trigger, a canvas, a start screen. */
function mount(options: ShortcutsDialogOptions = { shortcutsKey: SHORTCUTS_KEY }): Page {
  const root = document.createElement('div');
  const trigger = document.createElement('button');
  trigger.textContent = 'Menu';
  const menuEntry = document.createElement('button');
  menuEntry.textContent = 'Export as PNG';
  const canvas = document.createElementNS(SVG, 'svg');
  canvas.setAttribute('tabindex', '0');
  root.append(trigger, menuEntry, canvas);
  document.body.append(root);
  const page = { canvas, trigger, menuEntry, menuOpen: false, startScreen: false } as Page;
  const chrome: ShortcutsDialogChrome = {
    root,
    platform: 'other',
    lang: 'en',
    messages: {
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      zoomToActual: (percent) => `Zoom to ${percent}`,
      fit: 'Fit',
      keyNames: { ctrl: 'Ctrl', shift: 'Shift', plus: 'Plus', minus: 'Minus' },
      close: 'Close',
    },
    menu: {
      trigger,
      isOpen: () => page.menuOpen,
      close(closeOptions) {
        page.menuOpen = false;
        if (closeOptions?.restoreFocus) trigger.focus();
      },
    },
    isEmptyStateShown: () => page.startScreen,
  };
  const dialog = createShortcutsDialog(chrome, options);
  mounted.push({ root, dialog });
  return Object.assign(page, { chrome, dialog });
}

/** Presses the key on `target`; false when a listener prevented it. */
function press(target: Element, init: KeyboardEventInit = {}): boolean {
  return target.dispatchEvent(
    new KeyboardEvent('keydown', { key: '?', bubbles: true, cancelable: true, ...init }),
  );
}

describe('the keyboard shortcuts dialog', () => {
  it('opens on its key from the canvas, prevents it and gives the focus back to the canvas', () => {
    const page = mount();
    page.canvas.focus();
    expect(press(page.canvas, { shiftKey: true })).toBe(false);
    expect(page.dialog.isOpen()).toBe(true);
    page.dialog.close();
    expect(document.activeElement).toBe(page.canvas);
  });

  it('opened from the menu entry, gives the focus back to the menu trigger', () => {
    const page = mount();
    page.trigger.focus();
    page.dialog.open();
    page.dialog.close();
    expect(document.activeElement).toBe(page.trigger);
  });

  it('lists its key in a Help group', () => {
    const page = mount();
    const rows = [...page.chrome.root.querySelectorAll('.diagram-shortcuts tr')].map((row) =>
      [...row.children].map((cell) => cell.textContent),
    );
    expect(rows.at(-1)).toEqual(['Keyboard shortcuts', '?']);
  });

  it('leaves modified, composed and already handled keys alone', () => {
    const page = mount();
    for (const modifier of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
      expect(press(page.canvas, modifier)).toBe(true);
    }
    expect(press(page.canvas, { isComposing: true })).toBe(true);
    const handled = (event: Event) => event.preventDefault();
    window.addEventListener('keydown', handled, true);
    try {
      press(page.canvas);
    } finally {
      window.removeEventListener('keydown', handled, true);
    }
    expect(page.dialog.isOpen()).toBe(false);
  });

  it('leaves the key to text fields', () => {
    const page = mount();
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    const fields = [
      document.createElement('input'),
      document.createElement('textarea'),
      document.createElement('select'),
      editable,
    ];
    page.chrome.root.append(...fields);
    for (const field of fields) expect(press(field)).toBe(true);
    expect(page.dialog.isOpen()).toBe(false);
  });

  it('opens nothing over another dialog or the start screen', () => {
    const page = mount();
    const popover = document.createElement('div');
    popover.setAttribute('role', 'dialog');
    page.chrome.root.append(popover);
    expect(press(page.canvas)).toBe(true);
    popover.hidden = true;
    page.startScreen = true;
    expect(press(page.canvas)).toBe(true);
    expect(page.dialog.isOpen()).toBe(false);
    page.startScreen = false;
    expect(press(page.canvas)).toBe(false);
    expect(page.dialog.isOpen()).toBe(true);
  });

  it('closes the open menu first, so the focus goes back to its trigger', () => {
    const page = mount();
    page.menuOpen = true;
    page.menuEntry.focus();
    press(page.menuEntry);
    expect(page.menuOpen).toBe(false);
    expect(page.dialog.isOpen()).toBe(true);
    page.dialog.close();
    expect(document.activeElement).toBe(page.trigger);
  });

  it('without a key listens to nothing and lists no Help group', () => {
    const page = mount({});
    expect(press(page.canvas)).toBe(true);
    expect(page.dialog.isOpen()).toBe(false);
    const titles = [...page.chrome.root.querySelectorAll('.diagram-shortcuts h3')].map(
      (title) => title.textContent,
    );
    expect(titles).toEqual(['Edit', 'Tools', 'View']);
  });

  it('stops listening once destroyed', () => {
    const page = mount();
    page.dialog.destroy();
    expect(press(page.canvas)).toBe(true);
    expect(page.chrome.root.querySelector('.diagram-shortcuts')).toBeNull();
  });
});
