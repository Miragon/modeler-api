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

  test("a click on a File entry hands the focus to the canvas; Enter and Export leave it on the trigger", async ({
    page,
  }) => {
    await openWeb(page);
    const trigger = page.locator('[data-chrome="menu"]');
    await trigger.click();
    await page.locator('[role="menu"] [data-menu-id="show-example"]').click();
    await expect(page.locator(".djs-container > svg")).toBeFocused();

    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('[role="menu"] [data-menu-id="new-diagram"]')).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(trigger).toBeFocused();

    await trigger.click();
    await page.locator('[role="menu"] [data-menu-id="export-png"]').click();
    await expect(trigger).toBeFocused();
    expect(await calls(page)).toEqual(["new-diagram", "export-png"]);
  });

  test("a click on a palette entry hands the focus to the canvas, so Delete removes what it placed", async ({
    page,
  }) => {
    await openWeb(page, "?empty");
    await page.locator('[data-chrome="empty-state"] button').first().click();
    const svg = page.locator(".djs-container > svg");
    const box = await svg.boundingBox();
    if (!box) throw new Error("no canvas");
    await page.locator('[data-chrome="palette"] [data-action="create.box"]').click();
    await expect(svg).toBeFocused();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator(".djs-shape.selected")).toHaveCount(1);
    await page.keyboard.press("Delete");
    await expect(page.locator(".djs-shape")).toHaveCount(0);
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
