import { test, expect } from "@playwright/test";

// A share URL / saved file can contain relationships whose ids came from
// diagram-js' session id counter (`connection_N`) of an earlier session. After
// a reload that counter restarts, so drawing a new relationship used to
// re-generate one of the imported ids — the create command died with
// "element <connection_N> already exists" and the just-drawn line silently
// vanished on release (regression).
const DOC = {
  version: 1,
  title: "t",
  contexts: [
    { id: "a", label: "A", position: { x: 100, y: 100 }, size: { width: 200, height: 110 } },
    { id: "b", label: "B", position: { x: 620, y: 100 }, size: { width: 200, height: 110 } },
    { id: "c", label: "C", position: { x: 100, y: 400 }, size: { width: 200, height: 110 } },
    { id: "d", label: "D", position: { x: 620, y: 400 }, size: { width: 200, height: 110 } },
  ],
  // cover the counter range a fresh session starts generating from (the first
  // drawn connection used to get `connection_13`), one relationship per pair
  relationships: [
    { id: "connection_12", from: "c", to: "d", pattern: "upstream-downstream" },
    { id: "connection_13", from: "a", to: "b", pattern: "upstream-downstream" },
    { id: "connection_14", from: "a", to: "c", pattern: "upstream-downstream" },
    { id: "connection_15", from: "b", to: "d", pattern: "upstream-downstream" },
  ],
};

test("drawing a connection in a reloaded document with counter-style ids", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => "__cmModeler" in window);
  await page.evaluate(
    (doc) =>
      (
        window as unknown as { __cmModeler: { importDocument(d: unknown): unknown } }
      ).__cmModeler.importDocument(doc),
    DOC,
  );

  const a = (await page.locator('.tt-canvas [data-element-id="a"]').boundingBox())!;
  await page.mouse.click(a.x + a.width / 2, a.y + a.height / 2);
  const handle = page.locator('.cm-connect-handle[data-side="bottom"]');
  await expect(handle).toBeVisible();
  const hb = (await handle.boundingBox())!;
  const d = (await page.locator('.tt-canvas [data-element-id="d"]').boundingBox())!;
  const tx = d.x + d.width / 2;
  const ty = d.y + d.height / 2;

  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move((hb.x + tx) / 2, (hb.y + ty) / 2, { steps: 6 });
  await page.mouse.move(tx, ty, { steps: 6 });
  await page.mouse.up();

  const rels = await page.evaluate(
    () =>
      (
        window as unknown as {
          __cmModeler: {
            exportDocument(): { relationships: Array<{ id: string; from: string; to: string }> };
          };
        }
      ).__cmModeler.exportDocument().relationships,
  );
  expect(rels).toHaveLength(5);
  const created = rels.find((r) => r.from === "a" && r.to === "d")!;
  expect(created).toBeDefined();
  expect(created.id).toMatch(/^rel_/);
});
