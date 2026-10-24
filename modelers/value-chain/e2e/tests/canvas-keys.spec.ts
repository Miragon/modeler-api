import { expect, test, type Page } from "@playwright/test";
import { exportDocument, exportText, openApp, openExample } from "./support/webapp.js";

/**
 * The canvas keys act only while the canvas has the focus. A context-pad entry that opens nothing
 * hands it back after a pointer press, so Cmd/Ctrl+Z takes back what the entry just did.
 */

function shape(page: Page, id: string) {
  return page.locator(`.djs-shape[data-element-id="${id}"]`);
}

async function elementIds(page: Page): Promise<string[]> {
  return (await exportDocument(page)).elements.map((element) => element.id);
}

test("with nothing focused, Delete leaves the selected step", async ({ page }) => {
  await openApp(page);
  await openExample(page);
  await shape(page, "step-testing").click();
  await expect(page.locator(".djs-context-pad.open")).toBeVisible();
  await page.evaluate(() => (document.activeElement as HTMLElement | SVGElement | null)?.blur());
  await expect(page.locator("body")).toBeFocused();

  await page.keyboard.press("Delete");
  expect(await elementIds(page)).toContain("step-testing");
});

test("Cmd/Ctrl+Z right after a pointer on the pad's Delete or Connect takes it back", async ({
  page,
}) => {
  await openApp(page);
  await openExample(page);
  const original = await exportText(page);
  const connections = (await exportDocument(page)).connections.length;

  await shape(page, "step-testing").click();
  await page.locator('.djs-context-pad.open [data-action="delete"]').click();
  await expect.poll(() => elementIds(page)).not.toContain("step-testing");
  await page.keyboard.press("ControlOrMeta+Z");
  await expect.poll(() => exportText(page)).toBe(original);

  await shape(page, "step-testing").click();
  await page.locator('.djs-context-pad.open [data-action="connect.sequence"]').click();
  await shape(page, "step-assembly").click();
  await expect
    .poll(async () => (await exportDocument(page)).connections.length)
    .toBe(connections + 1);
  await page.keyboard.press("ControlOrMeta+Z");
  await expect.poll(() => exportText(page)).toBe(original);
});
