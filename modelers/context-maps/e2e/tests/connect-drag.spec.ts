import { test, expect } from "@playwright/test";

const DOC = {
  version: 1,
  title: "t",
  contexts: [
    { id: "a", label: "A", position: { x: 150, y: 200 }, size: { width: 200, height: 110 } },
    { id: "b", label: "B", position: { x: 620, y: 200 }, size: { width: 200, height: 110 } },
  ],
  relationships: [],
};

// The full user gesture: select a context, press one of its connect handles,
// drag with the REAL mouse, release over another context — the relationship
// must be created (regression: hover used to be swallowed during the drag).
test("mouse drag from a connect handle onto another context draws the line", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => "__cmModeler" in window);
  await page.evaluate((doc) => {
    const m = (
      window as unknown as {
        __cmModeler: {
          importDocument(d: unknown): unknown;
          get(n: string): unknown;
        };
      }
    ).__cmModeler;
    m.importDocument(doc);
    const registry = m.get("elementRegistry") as { get(id: string): unknown };
    (m.get("selection") as { select(el: unknown): void }).select(registry.get("a"));
  }, DOC);

  const handle = page.locator('.cm-connect-handle[data-side="right"]');
  await expect(handle).toBeVisible();
  const hb = (await handle.boundingBox())!;
  const tb = (await page.locator('.tt-canvas [data-element-id="b"]').boundingBox())!;
  const tx = tb.x + tb.width / 2;
  const ty = tb.y + tb.height / 2;

  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move((hb.x + tx) / 2, ty, { steps: 5 });
  await page.mouse.move(tx, ty, { steps: 5 });
  // live preview follows the drag
  await expect(page.locator(".djs-dragger")).toHaveCount(1);
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
});
