import { test, expect } from "@playwright/test";
import { element, openMap, relationships } from "./support/app.js";

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
  await openMap(page, DOC);
  await page.evaluate(() => {
    const modeler = window.__cmModeler;
    const registry = modeler.get<{ get(id: string): unknown }>("elementRegistry");
    modeler.get<{ select(element: unknown): void }>("selection").select(registry.get("a"));
  });

  const arm = page.locator('.djs-context-pad.open [data-action="connect"]');
  await expect(arm).toBeVisible();
  const ab = (await arm.boundingBox())!;

  const tb = (await element(page, "b").boundingBox())!;
  const tx = tb.x + tb.width / 2;
  const ty = tb.y + tb.height / 2;

  await page.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2);
  await page.mouse.down();
  await page.mouse.move((ab.x + tx) / 2, ty, { steps: 5 });
  // live preview follows the drag
  await expect(page.locator(".djs-dragger")).toHaveCount(1);
  await page.mouse.move(tx, ty, { steps: 5 });
  await page.mouse.up();

  const rels = await relationships(page);
  expect(rels).toHaveLength(1);
  expect(rels[0]).toMatchObject({ from: "a", to: "b", pattern: "upstream-downstream" });
});
