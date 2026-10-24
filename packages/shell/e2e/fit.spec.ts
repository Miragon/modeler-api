import { expect, test, type Page } from "@playwright/test";

/*
 * The fit against an open legend whose card changes its width after the first fit, as it settles
 * once its font has loaded. The demo's rows are narrower than the card's minimum width, so a
 * wider row stands in for the font.
 */

async function openWithLegend(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/?host=ide&legend=open");
  await page.waitForFunction(() => window.__demo?.ready === true);
  await expect(page.locator(".cd-shell")).toHaveAttribute("data-legend", "open");
}

/** Widens the open card by a row longer than its minimum width. */
async function widenLegend(page: Page): Promise<void> {
  await page.evaluate(() => {
    const row = document.createElement("div");
    row.className = "cd-shell-legend-row";
    row.textContent = "A legend row wider than the card's minimum width";
    window.__demo?.shell.legend?.body.append(row);
  });
}

/** The content's centre minus the free rectangle's centre, in screen pixels, and the left inset. */
function offsetFromFreeCentre(page: Page) {
  return page.evaluate(() => {
    const demo = window.__demo;
    const bounds = demo?.contentBounds();
    const view = demo?.connection.viewport.getViewbox();
    if (!demo || !bounds || !view) throw new Error("nothing fitted");
    const scale = demo.connection.viewport.zoom();
    const insets = demo.shell.fitInsets();
    const width = view.width * scale;
    const height = view.height * scale;
    return {
      left: insets.left,
      x:
        (bounds.x + bounds.width / 2 - view.x) * scale -
        (insets.left + (width - insets.left - insets.right) / 2),
      y:
        (bounds.y + bounds.height / 2 - view.y) * scale -
        (insets.top + (height - insets.top - insets.bottom) / 2),
    };
  });
}

/** Below 1px counts as centred, as in the modelers' fit tests. */
function withinAPixel(offset: number): number {
  return Math.abs(offset) < 1 ? 0 : Math.round(offset);
}

function nextFrames(page: Page): Promise<void> {
  return page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

test.describe("fit with an open legend", () => {
  test("fits once more when the card's width changes after the first fit", async ({ page }) => {
    await openWithLegend(page);
    const fitted = await offsetFromFreeCentre(page);
    expect([withinAPixel(fitted.x), withinAPixel(fitted.y)]).toEqual([0, 0]);

    await widenLegend(page);
    await expect
      .poll(async () => {
        const { left, x, y } = await offsetFromFreeCentre(page);
        return { wider: left > fitted.left + 4, x: withinAPixel(x), y: withinAPixel(y) };
      })
      .toEqual({ wider: true, x: 0, y: 0 });
    expect(await page.evaluate(() => window.__demo?.connection.viewport.isAutomatic())).toBe(true);
  });

  test("keeps the view the user zoomed when the card's width changes", async ({ page }) => {
    await openWithLegend(page);
    await page.evaluate(() => window.__demo?.connection.viewport.stepZoom(-1));
    const zoomed = await page.evaluate(() => window.__demo?.connection.viewport.getViewbox());

    await widenLegend(page);
    await nextFrames(page);
    expect(await page.evaluate(() => window.__demo?.connection.viewport.getViewbox())).toEqual(
      zoomed,
    );
  });
});
