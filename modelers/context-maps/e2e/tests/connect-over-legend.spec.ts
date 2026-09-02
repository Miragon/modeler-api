import { test, expect } from "@playwright/test";

// The legend box floats over the bottom-left corner of the map. Releasing a
// connect drag on a context that sits BEHIND it must still draw the
// relationship (regression: the legend swallowed the hover, `connect.out`
// reset the drop target, and the line silently vanished on release).
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
  await page.goto("/");
  await page.waitForFunction(() => "__cmModeler" in window);
  await page.evaluate(
    (doc) =>
      (
        window as unknown as { __cmModeler: { importDocument(d: unknown): unknown } }
      ).__cmModeler.importDocument(doc),
    DOC,
  );
  // Import auto-fits (centres) the content; pin the viewbox 1:1 so canvas
  // coordinates equal screen coordinates and B provably sits behind the
  // bottom-left legend.
  await page.evaluate(() => {
    interface Canvas {
      viewbox(box: { x: number; y: number; width: number; height: number }): unknown;
    }
    const m = (window as unknown as { __cmModeler: { get(n: string): Canvas } }).__cmModeler;
    m.get("canvas").viewbox({ x: 0, y: 0, width: 1280, height: 720 });
  });

  // the drop point (centre of B) must actually be covered by the legend,
  // otherwise this test does not exercise the regression
  const b = (await page.locator('.tt-canvas [data-element-id="b"]').boundingBox())!;
  const tx = b.x + b.width / 2;
  const ty = b.y + b.height / 2;
  const legend = (await page.locator(".cm-legend").boundingBox())!;
  expect(ty).toBeGreaterThan(legend.y);
  expect(tx).toBeGreaterThan(legend.x);
  expect(tx).toBeLessThan(legend.x + legend.width);

  const a = (await page.locator('.tt-canvas [data-element-id="a"]').boundingBox())!;
  await page.mouse.click(a.x + a.width / 2, a.y + a.height / 2);
  const arm = page.locator('.djs-context-pad.open [data-action="connect"]');
  await expect(arm).toBeVisible();
  await arm.click();

  await page.mouse.move((a.x + tx) / 2, (a.y + ty) / 2, { steps: 6 });
  await page.mouse.move(tx, ty, { steps: 6 });
  await page.mouse.click(tx, ty);

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
    () => getComputedStyle(document.querySelector(".cm-legend")!).pointerEvents,
  );
  expect(pointerEvents).not.toBe("none");
});
