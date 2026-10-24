import { expect, test, type Page, type Route } from "@playwright/test";

/*
 * The fit against a legend that is open from the start while its font is still loading: the card
 * settles to another width once the font has loaded, which can be after the first fit measured it.
 * The demo's `wideLegend` row makes the card's width depend on its font; holding back the font
 * files keeps the first fit on the fallback font until the test lets them through.
 */

/** Holds back every font file until the returned function lets them through. */
async function holdFonts(page: Page): Promise<() => Promise<void>> {
  const held: Route[] = [];
  let released = false;
  await page.route("**/*.woff2", async (route) => {
    if (released) await route.continue();
    else held.push(route);
  });
  return async () => {
    released = true;
    await Promise.all(held.splice(0).map((route) => route.continue()));
  };
}

async function openWithLegend(page: Page, search: string): Promise<void> {
  // A held font delays the load event, so the page counts as open once the demo is ready.
  await page.goto(`/?${search}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__demo?.ready === true);
  await expect(page.locator(".cd-shell")).toHaveAttribute("data-legend", "open");
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

/** Resolves once the fonts have loaded and the frames after that have been laid out. */
function fontsSettled(page: Page): Promise<void> {
  return page.evaluate(async () => {
    await document.fonts.ready;
    for (let frame = 0; frame < 3; frame++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  });
}

const viewbox = (page: Page) =>
  page.evaluate(() => window.__demo?.connection.viewport.getViewbox());

test.describe("fit with a legend open from the start", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test("fits once more when the card settles as its font loads after the first fit", async ({
    page,
  }) => {
    const releaseFonts = await holdFonts(page);
    await openWithLegend(page, "host=ide&legend=open&wideLegend");
    expect(await page.evaluate(() => document.fonts.status)).toBe("loading");
    const fitted = await offsetFromFreeCentre(page);
    expect([withinAPixel(fitted.x), withinAPixel(fitted.y)]).toEqual([0, 0]);

    await releaseFonts();
    await expect
      .poll(async () => {
        const { left, x, y } = await offsetFromFreeCentre(page);
        return {
          settled: Math.abs(left - fitted.left) >= 1,
          x: withinAPixel(x),
          y: withinAPixel(y),
        };
      })
      .toEqual({ settled: true, x: 0, y: 0 });
    expect(await page.evaluate(() => window.__demo?.connection.viewport.isAutomatic())).toBe(true);
  });

  test("keeps the view the user zoomed before the font loaded", async ({ page }) => {
    const releaseFonts = await holdFonts(page);
    await openWithLegend(page, "host=ide&legend=open&wideLegend");
    const before = await offsetFromFreeCentre(page);
    await page.evaluate(() => window.__demo?.connection.viewport.stepZoom(-1));
    const zoomed = await viewbox(page);

    await releaseFonts();
    await fontsSettled(page);
    expect(Math.abs((await offsetFromFreeCentre(page)).left - before.left)).toBeGreaterThanOrEqual(
      1,
    );
    expect(await viewbox(page)).toEqual(zoomed);
  });

  test("keeps the view once the fonts have loaded: later changes of the card never fit (guide §5.9)", async ({
    page,
  }) => {
    // Low enough that the card hits its maximum height, so the pill shrinks it.
    await page.setViewportSize({ width: 1280, height: 220 });
    await openWithLegend(page, "host=web&legend=open");
    await fontsSettled(page);
    const opened = await viewbox(page);
    const card = page.locator(".cd-shell-legend");
    const cardHeight = await card.evaluate((element) => element.getBoundingClientRect().height);

    await page.evaluate(() => window.__demo?.shell.setProblems({ count: 2, errors: 1 }));
    await expect
      .poll(() => card.evaluate((element) => element.getBoundingClientRect().height))
      .toBeLessThan(cardHeight);
    await page.evaluate(() => {
      const row = document.createElement("div");
      row.className = "cd-shell-legend-row";
      row.textContent = "A row wider than the card's minimum width";
      window.__demo?.shell.legend?.body.append(row);
    });
    await fontsSettled(page);
    expect(await viewbox(page)).toEqual(opened);
    expect(await page.evaluate(() => window.__demo?.connection.viewport.isAutomatic())).toBe(true);
  });
});
