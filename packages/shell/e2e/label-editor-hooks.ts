import type { Page } from "@playwright/test";

import type { LabelEditorHooks } from "../src/testing.js";

interface OpenedEditor {
  /** How often the editor was opened on this page; each open types a text no commit wrote yet. */
  opens: number;
  /** The demo's document changes when the last open resolved. */
  changes: number;
}

const openedEditors = new WeakMap<Page, OpenedEditor>();

/** The centre of the first demo box a pointer reaches, in viewport coordinates. */
const reachableBoxProbe = (_: null): { x: number; y: number } | null => {
  for (const shape of document.querySelectorAll(".djs-shape[data-element-id]")) {
    const rect = shape.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    if (hit && shape.contains(hit)) return { x, y };
  }
  return null;
};

/**
 * The `labelEditor` hooks for a demo page, as a modeler's suite writes them: a double-click on a box
 * opens its editor, the typed text replaces the selected label, and a document change is a change
 * of the demo's command stack (`changes` reads it from the page's handle).
 */
export function demoLabelEditor(changes: (page: Page) => Promise<number>): LabelEditorHooks<Page> {
  return {
    async open(page) {
      const box = await page.evaluate(reachableBoxProbe, null);
      if (!box) throw new Error("demo: no box a pointer reaches to edit its label");
      await page.mouse.dblclick(box.x, box.y);
      await page.waitForFunction(() => document.activeElement?.classList.contains("demo-label-editor"));
      const opens = (openedEditors.get(page)?.opens ?? 0) + 1;
      const typed = `Renamed box ${opens}`;
      await page.keyboard.type(typed);
      openedEditors.set(page, { opens, changes: await changes(page) });
      return typed;
    },
    async documentChanged(page) {
      const opened = openedEditors.get(page);
      return opened !== undefined && (await changes(page)) !== opened.changes;
    },
  };
}
