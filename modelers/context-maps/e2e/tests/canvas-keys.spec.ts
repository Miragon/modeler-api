import { expect, test, type Page } from "@playwright/test";
import { SAMPLE_DOCUMENT } from "@miragon/context-maps-schema-model";
import { element, exportMap, mapText, openMap } from "./support/app.js";

/**
 * The canvas keys act only while the canvas has the focus. A context-pad entry that opens nothing
 * hands it back after a pointer press, so Cmd/Ctrl+Z takes back what the entry just did.
 */

const ASYMMETRIC_RELATIONSHIP = "rel_evaluation_schedule";

async function clickContext(page: Page, id: string): Promise<void> {
  const box = (await element(page, id).first().boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator(".djs-context-pad.open")).toBeVisible();
}

async function selectWithoutFocus(page: Page, id: string): Promise<void> {
  await page.evaluate((elementId) => {
    const modeler = window.__cmModeler;
    const registry = modeler.get<{ get(id: string): unknown }>("elementRegistry");
    modeler.get<{ select(element: unknown): void }>("selection").select(registry.get(elementId));
  }, id);
  await expect(page.locator(".djs-context-pad.open")).toBeVisible();
}

async function contextIds(page: Page): Promise<string[]> {
  return (await exportMap(page)).contexts.map((context) => context.id);
}

// Delete only: with nothing focused, WebKit's Backspace is the browser's and goes back a page.
test("with nothing focused, Delete leaves the selected context", async ({ page }) => {
  await openMap(page, SAMPLE_DOCUMENT);
  await clickContext(page, "ctx_cfp");
  await page.evaluate(() => (document.activeElement as HTMLElement | SVGElement | null)?.blur());
  await expect(page.locator("body")).toBeFocused();

  await page.keyboard.press("Delete");
  expect(await contextIds(page)).toContain("ctx_cfp");
});

test("Cmd/Ctrl+Z after a pointer on a context-pad entry takes back what it did", async ({
  page,
}) => {
  await openMap(page, SAMPLE_DOCUMENT);
  const original = await mapText(page);

  await selectWithoutFocus(page, ASYMMETRIC_RELATIONSHIP);
  await page.locator('.djs-context-pad.open [data-action="swap-ends"]').click();
  await expect.poll(() => mapText(page)).not.toBe(original);
  await page.keyboard.press("ControlOrMeta+Z");
  await expect.poll(() => mapText(page)).toBe(original);

  await clickContext(page, "ctx_cfp");
  await page.locator('.djs-context-pad.open [data-action="delete"]').click();
  await expect.poll(() => contextIds(page)).not.toContain("ctx_cfp");
  await page.keyboard.press("ControlOrMeta+Z");
  await expect.poll(() => mapText(page)).toBe(original);
});
