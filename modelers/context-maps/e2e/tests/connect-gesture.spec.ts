import { test, expect } from "@playwright/test";

// The exact user gesture, end to end with the REAL mouse: click a context to
// select it, press one of its four connect handles, drag, release over another
// component. Between a FREE pair this draws the line; between an already
// connected pair it is refused (one relationship per pair) with a not-allowed
// cursor.
const DOC = {
  version: 1,
  title: "t",
  contexts: [
    { id: "a", label: "A", position: { x: 150, y: 200 }, size: { width: 200, height: 110 } },
    { id: "b", label: "B", position: { x: 620, y: 200 }, size: { width: 200, height: 110 } },
    { id: "c", label: "C", position: { x: 380, y: 460 }, size: { width: 200, height: 110 } },
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

test("full user gesture: click-select, press handle, release over free component", async ({
  page,
}) => {
  await setup(page);
  // real click on A to select it
  const a = (await page.locator('.tt-canvas [data-element-id="a"]').boundingBox())!;
  await page.mouse.click(a.x + a.width / 2, a.y + a.height / 2);
  const handle = page.locator('.cm-connect-handle[data-side="bottom"]');
  await expect(handle).toBeVisible();
  const hb = (await handle.boundingBox())!;
  const c = (await page.locator('.tt-canvas [data-element-id="c"]').boundingBox())!;

  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 8 });
  await page.mouse.up();

  const after = await rels(page);
  console.log("after free-pair drag:", JSON.stringify(after));
  expect(after).toHaveLength(2);

  // the preview must be gone after release and must NOT chase the cursor
  await expect(page.locator(".djs-dragger")).toHaveCount(0);
  await page.mouse.move(300, 500, { steps: 3 });
  await page.mouse.move(600, 350, { steps: 3 });
  await expect(page.locator(".djs-dragger")).toHaveCount(0);

  // the marking persists: the NEW relationship is selected, inspector open
  const selected = await page.evaluate(() => {
    const m = (window as unknown as { __cmModeler: { get(n: string): unknown } }).__cmModeler;
    return (m.get("selection") as { get(): Array<{ id: string }> }).get().map((s) => s.id);
  });
  expect(selected).toHaveLength(1);
  expect(String(selected[0])).toMatch(/^rel_/);
  await expect(page.locator(".tt-inspector")).toBeVisible();
});

test("a plain click on a handle does not leave a line chasing the cursor", async ({ page }) => {
  await setup(page);
  const a = (await page.locator('.tt-canvas [data-element-id="a"]').boundingBox())!;
  await page.mouse.click(a.x + a.width / 2, a.y + a.height / 2);
  const handle = page.locator('.cm-connect-handle[data-side="top"]');
  const hb = (await handle.boundingBox())!;

  // press + release on the handle without dragging
  await page.mouse.click(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.move(500, 400, { steps: 4 });
  await page.mouse.move(250, 300, { steps: 4 });
  await expect(page.locator(".djs-dragger")).toHaveCount(0);
  expect(await rels(page)).toHaveLength(1);
});

test("already-connected pair: drag is refused (no duplicate line)", async ({ page }) => {
  await setup(page);
  const a = (await page.locator('.tt-canvas [data-element-id="a"]').boundingBox())!;
  await page.mouse.click(a.x + a.width / 2, a.y + a.height / 2);
  const handle = page.locator('.cm-connect-handle[data-side="right"]');
  const hb = (await handle.boundingBox())!;
  const b = (await page.locator('.tt-canvas [data-element-id="b"]').boundingBox())!;

  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  const cursorTarget = await page.evaluate(() => {
    const g = document.querySelector('[data-element-id="b"]');
    return g ? getComputedStyle(g as Element).cursor : "-";
  });
  console.log("cursor over already-connected target:", cursorTarget);
  await page.mouse.up();

  const after = await rels(page);
  console.log("after duplicate drag:", JSON.stringify(after.length));
  expect(after).toHaveLength(1);

  // refused drag: no hanging preview, and the source context stays marked
  await expect(page.locator(".djs-dragger")).toHaveCount(0);
  await expect(page.locator(".cm-connect-handle")).toHaveCount(4);
});
