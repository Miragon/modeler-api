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

// The press-drag-release variant with the REAL mouse: press the context pad's
// connect arrow, drag — the native dragstart hands over to diagram-js and the
// live preview follows — and release over the target context.
test("dragging from the pad's connect arrow draws the line", async ({ page }) => {
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

  const arm = page.locator('.djs-context-pad.open [data-action="connect"]');
  await expect(arm).toBeVisible();
  const ab = (await arm.boundingBox())!;

  const tb = (await page.locator('.tt-canvas [data-element-id="b"]').boundingBox())!;
  const tx = tb.x + tb.width / 2;
  const ty = tb.y + tb.height / 2;

  await page.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2);
  await page.mouse.down();
  await page.mouse.move((ab.x + tx) / 2, ty, { steps: 5 });
  // live preview follows the drag
  await expect(page.locator(".djs-dragger")).toHaveCount(1);
  await page.mouse.move(tx, ty, { steps: 5 });
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
