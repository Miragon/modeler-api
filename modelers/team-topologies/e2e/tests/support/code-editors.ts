import type { Locator, Page } from "@playwright/test";

/** Where a key pressed in a code editor ended: at `window` as it was, taken by a listener, or never. */
export type KeyReach = "free" | "prevented" | "stopped";

const MODIFIERS = ["Alt", "Control", "Meta", "Shift"];

/**
 * Focusable stand-ins for the code editors a page embeds next to the modeler: an element that
 * edits through an `EditContext` (where the browser has one, Chromium) and an element inside a
 * Monaco editor. Neither is an input or contenteditable; both are text fields (guide §5.8).
 */
export async function codeEditors(page: Page): Promise<Locator[]> {
  const ids = await page.evaluate(() => {
    const EditContext = (window as { EditContext?: new () => object }).EditContext;
    const editors: HTMLElement[] = [];
    if (EditContext) {
      const editor = document.body.appendChild(document.createElement("div"));
      editors.push(Object.assign(editor, { editContext: new EditContext() }));
    }
    const monaco = document.body.appendChild(document.createElement("div"));
    monaco.className = "monaco-editor";
    editors.push(monaco.appendChild(document.createElement("div")));
    return editors.map((editor, index) => {
      editor.id = `code-editor-${index}`;
      editor.tabIndex = -1;
      return editor.id;
    });
  });
  return ids.map((id) => page.locator(`#${id}`));
}

/** Presses `key` in `editor` and tells where its keydown ended. */
export async function pressIn(editor: Locator, key: string): Promise<KeyReach> {
  await editor.focus();
  await editor.evaluate((element, modifiers) => {
    element.dataset.keydown = "stopped";
    if (element.dataset.recorded) return;
    element.dataset.recorded = "true";
    window.addEventListener("keydown", (event) => {
      if (event.target !== element || modifiers.includes(event.key)) return;
      element.dataset.keydown = event.defaultPrevented ? "prevented" : "free";
    });
  }, MODIFIERS);
  await editor.page().keyboard.press(key);
  return (await editor.getAttribute("data-keydown")) as KeyReach;
}
