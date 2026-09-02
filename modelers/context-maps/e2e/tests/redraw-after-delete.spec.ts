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

const rels = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as { __cmModeler: { exportDocument(): { relationships: unknown[] } } }
      ).__cmModeler.exportDocument().relationships,
  );

async function drawLine(page: import("@playwright/test").Page) {
  const a = (await page.locator('.tt-canvas [data-element-id="a"]').boundingBox())!;
  await page.mouse.click(a.x + a.width / 2, a.y + a.height / 2);
  const arm = page.locator('.djs-context-pad.open [data-action="connect"]');
  await arm.waitFor();
  await arm.click();
  const b = (await page.locator('.tt-canvas [data-element-id="b"]').boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 });
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}

// Regression: after drawing a line and deleting it, drawing again between the
// same two contexts must work — the fresh relationship must be selected (the
// pad's one-shot click blocker keeps the finishing click from re-selecting the
// target) — and the VERY NEXT click after any of it must select normally.
test("draw, delete via inspector, immediately draw again", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => "__cmModeler" in window);
  await page.evaluate(
    (doc) =>
      (
        window as unknown as { __cmModeler: { importDocument(d: unknown): unknown } }
      ).__cmModeler.importDocument(doc),
    DOC,
  );

  await drawLine(page);
  expect(await rels(page)).toHaveLength(1);

  // the fresh relationship is selected — delete it via its context pad
  await page.click('.djs-context-pad.open [data-action="delete"]');
  expect(await rels(page)).toHaveLength(0);

  // no waiting: the immediate next click on A must select it (context pad shows)
  const a = (await page.locator('.tt-canvas [data-element-id="a"]').boundingBox())!;
  await page.mouse.click(a.x + a.width / 2, a.y + a.height / 2);
  await expect(page.locator(".djs-context-pad.open")).toBeVisible();

  await drawLine(page);
  expect(await rels(page)).toHaveLength(1);
});
