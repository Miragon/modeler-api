import { test, expect } from "@playwright/test";

// The legend boxes float above the bottom of the map. Releasing a connect drag
// on a context that sits BEHIND them must still draw the relationship
// (regression: the legend swallowed the hover, `connect.out` reset the drop
// target, and the line silently vanished on release).
const DOC = {
  version: 1,
  title: "t",
  contexts: [
    { id: "a", label: "A", position: { x: 100, y: 80 }, size: { width: 240, height: 140 } },
    { id: "b", label: "B", position: { x: 480, y: 520 }, size: { width: 240, height: 130 } },
  ],
  relationships: [],
};

test("connect drag released on a context behind the legend draws the line", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => "__cmModeler" in window);
  await page.evaluate(
    (doc) =>
      (
        window as unknown as { __cmModeler: { importDocument(d: unknown): unknown } }
      ).__cmModeler.importDocument(doc),
    DOC,
  );

  // the drop point (centre of B) must actually be covered by the legend,
  // otherwise this test does not exercise the regression
  const b = (await page.locator('.tt-canvas [data-element-id="b"]').boundingBox())!;
  const tx = b.x + b.width / 2;
  const ty = b.y + b.height / 2;
  const legend = (await page.locator(".cm-legends").boundingBox())!;
  expect(ty).toBeGreaterThan(legend.y);

  const a = (await page.locator('.tt-canvas [data-element-id="a"]').boundingBox())!;
  await page.mouse.click(a.x + a.width / 2, a.y + a.height / 2);
  const handle = page.locator('.cm-connect-handle[data-side="bottom"]');
  await expect(handle).toBeVisible();
  const hb = (await handle.boundingBox())!;

  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move((hb.x + tx) / 2, (hb.y + ty) / 2, { steps: 6 });
  await page.mouse.move(tx, ty, { steps: 6 });
  await page.mouse.up();

  const rels = await page.evaluate(
    () =>
      (
        window as unknown as {
          __cmModeler: { exportDocument(): { relationships: Array<Record<string, unknown>> } };
        }
      ).__cmModeler.exportDocument().relationships,
  );
  expect(rels).toHaveLength(1);
  expect(rels[0]).toMatchObject({ from: "a", to: "b", pattern: "upstream-downstream" });

  // outside a drag the legend is interactive again (hover tooltips)
  const pointerEvents = await page.evaluate(
    () => getComputedStyle(document.querySelector(".cm-legends")!).pointerEvents,
  );
  expect(pointerEvents).not.toBe("none");
});
