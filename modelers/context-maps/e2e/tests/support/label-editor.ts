import type { Page } from "@playwright/test";
import type { LabelEditorHooks } from "@miragon/modeler-shell/testing";

interface OpenedEditor {
  /** How often the editor was opened on this page; each open types a name no commit wrote yet. */
  opens: number;
  /** The host's document state when the last open resolved. */
  document: string;
}

const openedEditors = new WeakMap<Page, OpenedEditor>();

/** The centre of the first context a pointer reaches, in viewport coordinates. */
const reachableContextProbe = (root: string): { x: number; y: number } | null => {
  for (const shape of document.querySelectorAll(`${root} .djs-shape[data-element-id]`)) {
    const rect = shape.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    if (hit && shape.contains(hit)) return { x, y };
  }
  return null;
};

/**
 * The shell kit's `labelEditor` hooks for a page that shows a map: a double-click on a context
 * opens its name editor with the caret after the name, and the typed text stays uncommitted.
 * `documentState` reads what the host would save or send, so a commit shows as a change of it.
 */
export function contextNameEditor(
  documentState: (page: Page) => Promise<string>,
  root = ".cd-shell",
): LabelEditorHooks<Page> {
  return {
    async open(page) {
      const context = await page.evaluate(reachableContextProbe, root);
      if (!context) throw new Error("the map shows no context a pointer reaches to rename");
      await page.mouse.dblclick(context.x, context.y);
      await page.waitForFunction(() =>
        document.activeElement?.classList.contains("djs-direct-editing-content"),
      );
      const opens = (openedEditors.get(page)?.opens ?? 0) + 1;
      // No space: a contenteditable holds a trailing one as U+00A0, which the kit would not find.
      const typed = `-renamed-${opens}`;
      await page.keyboard.type(typed);
      openedEditors.set(page, { opens, document: await documentState(page) });
      return typed;
    },
    async documentChanged(page) {
      const opened = openedEditors.get(page);
      return opened !== undefined && (await documentState(page)) !== opened.document;
    },
  };
}
