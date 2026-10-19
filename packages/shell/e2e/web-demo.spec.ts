import { expect, test, type Page } from "@playwright/test";

/*
 * The web demo's own wiring (/web.html): the kit sees that the chrome clicks and closes, not what a
 * modeler's handlers do. These specs read `window.__webDemo.calls`, which the demo's handlers fill.
 */

async function openWeb(page: Page, query = ""): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/web.html${query}`);
  await page.waitForFunction(() => window.__webDemo?.ready === true);
}

function calls(page: Page): Promise<string[]> {
  return page.evaluate(() => [...(window.__webDemo?.calls ?? [])]);
}

test.describe("web demo wiring", () => {
  test("Share runs on a click and on Enter and confirms with a toast", async ({ page }) => {
    await openWeb(page);
    const primary = page.locator('[data-chrome="primary"]');
    await primary.click();
    await primary.focus();
    await page.keyboard.press("Enter");
    expect(await calls(page)).toEqual(["share", "share"]);
    await expect(page.locator('[data-chrome="toasts"] [data-status]').first()).toContainText("Link copied");
  });

  test("the File entries run their handlers after the menu closed", async ({ page }) => {
    await openWeb(page);
    for (const id of ["new-diagram", "open", "import"]) {
      await page.locator('[data-chrome="menu"]').click();
      await page.locator(`[role="menu"] [data-menu-id="${id}"]`).click();
      await expect(page.locator('[role="menu"]')).toBeHidden();
    }
    expect(await calls(page)).toEqual(["new-diagram", "open", "import"]);
  });

  test("a dropped board leaves the start screen; a problem row selects its element", async ({ page }) => {
    await openWeb(page, "?empty");
    await page.evaluate(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(["{}"], "board.json", { type: "application/json" }));
      for (const type of ["dragenter", "dragover", "drop"]) {
        document.body.dispatchEvent(
          new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer }),
        );
      }
    });
    await expect(page.locator('[data-chrome="empty-state"]')).toBeHidden();
    expect(await calls(page)).toEqual(["drop:board.json"]);

    await page.evaluate(() => window.__webDemo?.showProblems());
    await page.locator('[data-chrome="problems"]').click();
    await page.locator('[data-chrome="problems-popover"] button.cd-shell-problem').first().click();
    expect((await calls(page)).at(-1)).toMatch(/^select:.+/);
    await expect(page.locator(".djs-shape.selected")).toHaveCount(1);
  });
});
