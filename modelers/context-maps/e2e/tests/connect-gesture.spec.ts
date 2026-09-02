import { test, expect } from "@playwright/test";

// The exact user gestures, end to end with the REAL mouse, all running through
// the context pad's connect arrow: arm on a selected context, click a target
// to draw the line; Escape cancels without a chasing preview; a pair that is
// already connected is refused (one relationship per pair).
const DOC = {
  version: 1,
  title: "t",
  contexts: [
    { id: "a", label: "A", position: { x: 400, y: 80 }, size: { width: 240, height: 140 } },
    { id: "b", label: "B", position: { x: 620, y: 400 }, size: { width: 240, height: 130 } },
    { id: "c", label: "C", position: { x: 120, y: 460 }, size: { width: 200, height: 110 } },
  ],
  relationships: [{ id: "r_ab", from: "a", to: "b", pattern: "upstream-downstream" }],
};

async function setup(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForFunction(() => "__cmModeler" in window);
  await page.evaluate(
    (doc) =>
      (
        window as unknown as { __cmModeler: { importDocument(d: unknown): unknown } }
      ).__cmModeler.importDocument(doc),
    DOC,
  );
}

const rels = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as { __cmModeler: { exportDocument(): { relationships: unknown[] } } }
      ).__cmModeler.exportDocument().relationships,
  );

async function armConnect(page: import("@playwright/test").Page, sourceId: string) {
  const source = (await page.locator(`.tt-canvas [data-element-id="${sourceId}"]`).boundingBox())!;
  await page.mouse.click(source.x + source.width / 2, source.y + source.height / 2);
  const arm = page.locator('.djs-context-pad.open [data-action="connect"]');
  await expect(arm).toBeVisible();
  await arm.click();
}

test("full user gesture: select, arm connect in the pad, click a free target", async ({ page }) => {
  await setup(page);
  await armConnect(page, "a");

  const c = (await page.locator('.tt-canvas [data-element-id="c"]').boundingBox())!;
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 8 });
  await page.mouse.click(c.x + c.width / 2, c.y + c.height / 2);

  expect(await rels(page)).toHaveLength(2);

  // the fresh relationship is selected — the finishing click must not
  // re-select the target over it (the pad's one-shot click blocker)
  const selected = await page.evaluate(() => {
    const m = (window as unknown as { __cmModeler: { get(n: string): unknown } }).__cmModeler;
    return (m.get("selection") as { get(): Array<{ id: string }> }).get().map((s) => s.id);
  });
  expect(selected).toHaveLength(1);
  expect(String(selected[0])).toMatch(/^rel_/);
  // …and its context pad is open with the relationship actions
  await expect(page.locator('.djs-context-pad.open [data-action="pattern"]')).toBeVisible();

  // the preview is gone after completing and does NOT chase the cursor
  await page.mouse.move(100, 100, { steps: 4 });
  await expect(page.locator(".djs-dragger")).toHaveCount(0);
});

test("Escape cancels an armed connect without a chasing preview", async ({ page }) => {
  await setup(page);
  await armConnect(page, "a");

  await page.mouse.move(300, 300, { steps: 4 });
  await expect(page.locator(".djs-dragger")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await page.mouse.move(600, 500, { steps: 4 });
  await expect(page.locator(".djs-dragger")).toHaveCount(0);
  expect(await rels(page)).toHaveLength(1);

  // the very next click selects normally (nothing swallowed it)
  const c = (await page.locator('.tt-canvas [data-element-id="c"]').boundingBox())!;
  await page.mouse.click(c.x + c.width / 2, c.y + c.height / 2);
  await expect(page.locator(".djs-context-pad.open")).toBeVisible();
});

test("already-connected pair: the click is refused (no duplicate line)", async ({ page }) => {
  await setup(page);
  await armConnect(page, "a");

  const b = (await page.locator('.tt-canvas [data-element-id="b"]').boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 });
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);

  expect(await rels(page)).toHaveLength(1);
});
