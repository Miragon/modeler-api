import { test, expect } from "@playwright/test";
import { element, openMap, relationships } from "./support/app.js";

// The chrome's legend floats over the bottom-left corner of the map. Releasing a connect drag on a
// context that sits BEHIND it must still draw the relationship (regression: the legend swallowed
// the hover, `connect.out` reset the drop target, and the line silently vanished on release).
const DOC = {
  version: 1,
  title: "t",
  contexts: [
    { id: "a", label: "A", position: { x: 400, y: 80 }, size: { width: 240, height: 140 } },
    { id: "b", label: "B", position: { x: 40, y: 430 }, size: { width: 240, height: 130 } },
  ],
  relationships: [],
};

test("connect drag released on a context behind the legend draws the line", async ({ page }) => {
  await openMap(page, DOC);
  const legend = page.locator('[data-chrome="legend"]');
  await page.evaluate(() => window.__contextMapsApp!.shell.legend!.setOpen(true));
  await expect(legend).toBeVisible();
  // The import fits (centres) the content; pin the viewbox 1:1 so canvas coordinates equal screen
  // coordinates and B provably sits behind the bottom-left legend.
  await page.evaluate(() => {
    const canvas = window.__cmModeler.get<{
      viewbox(box: { x: number; y: number; width: number; height: number }): unknown;
    }>("canvas");
    canvas.viewbox({ x: 0, y: 0, width: 1280, height: 720 });
  });

  // the drop point (centre of B) must actually be covered by the legend, otherwise this test does
  // not exercise the regression
  const b = (await element(page, "b").boundingBox())!;
  const tx = b.x + b.width / 2;
  const ty = b.y + b.height / 2;
  const legendBox = (await legend.boundingBox())!;
  expect(ty).toBeGreaterThan(legendBox.y);
  expect(ty).toBeLessThan(legendBox.y + legendBox.height);
  expect(tx).toBeGreaterThan(legendBox.x);
  expect(tx).toBeLessThan(legendBox.x + legendBox.width);

  const a = (await element(page, "a").boundingBox())!;
  await page.mouse.click(a.x + a.width / 2, a.y + a.height / 2);
  const arm = page.locator('.djs-context-pad.open [data-action="connect"]');
  await expect(arm).toBeVisible();
  await arm.click();

  await page.mouse.move((a.x + tx) / 2, (a.y + ty) / 2, { steps: 6 });
  await page.mouse.move(tx, ty, { steps: 6 });
  await page.mouse.click(tx, ty);

  const rels = await relationships(page);
  expect(rels).toHaveLength(1);
  expect(rels[0]).toMatchObject({ from: "a", to: "b", pattern: "upstream-downstream" });

  // outside a drag the legend is interactive again (its close button, the row tooltips)
  await expect(legend).not.toHaveCSS("pointer-events", "none");
});
