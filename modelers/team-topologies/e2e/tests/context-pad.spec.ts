import { expect, test, type Page } from "@playwright/test";
import { diagramLink } from "./support/app.js";
import { CANVAS, centreOf, gotoApp } from "./support/modeler.js";

/**
 * The web app hands the renderer the shell's fit insets as its free area, so the context pad of a
 * team in the bottom right corner stays inside it, clear of the shell's islands (guide §5.13:
 * nothing on the canvas lies above an island, so an island would hide the pad's entries).
 */

const CORNER_TEAM = "team_bottom_right";
/** Wide enough that the fit zooms out and puts the second team into the free area's corner. */
const CORNERS_DOCUMENT = {
  version: 3,
  title: "Corners",
  nodes: [
    {
      id: "team_top_left",
      type: "stream-aligned",
      label: "Top left",
      position: { x: 0, y: 0 },
      size: { width: 160, height: 80 },
    },
    {
      id: CORNER_TEAM,
      type: "platform",
      label: "Bottom right",
      position: { x: 2400, y: 1200 },
      size: { width: 160, height: 80 },
    },
  ],
  interactions: [],
  flows: [],
  annotations: [],
};

/** The pad's entries that are not the topmost element at their centre, so no pointer reaches. */
function unreachableEntries(page: Page): Promise<string[]> {
  return page.evaluate((canvas) => {
    const pad = document.querySelector(`${canvas} .djs-context-pad.open`);
    if (!pad) return ["(no open pad)"];
    return [...pad.querySelectorAll<HTMLElement>(".entry")]
      .filter((entry) => {
        const box = entry.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return hit?.closest(".entry") !== entry;
      })
      .map((entry) => entry.getAttribute("data-action") ?? "");
  }, CANVAS);
}

test.describe("webapp: context pad", () => {
  test("a team in the bottom right corner keeps every pad entry reachable", async ({ page }) => {
    await gotoApp(page, diagramLink(CORNERS_DOCUMENT));
    const corner = await centreOf(page, CORNER_TEAM);
    await page.mouse.click(corner.x, corner.y);

    await expect(page.locator(`${CANVAS} .djs-context-pad.open .entry`)).toHaveCount(3);
    await expect.poll(() => unreachableEntries(page)).toEqual([]);

    const insets = await page.evaluate(() => window.__ttApp!.shell.fitInsets());
    const canvasBox = (await page.locator(CANVAS).boundingBox())!;
    const padBox = (await page.locator(`${CANVAS} .djs-context-pad.open`).boundingBox())!;
    expect(padBox.x).toBeGreaterThanOrEqual(canvasBox.x + insets.left);
    expect(padBox.y).toBeGreaterThanOrEqual(canvasBox.y + insets.top);
    expect(padBox.x + padBox.width).toBeLessThanOrEqual(
      canvasBox.x + canvasBox.width - insets.right,
    );
    expect(padBox.y + padBox.height).toBeLessThanOrEqual(
      canvasBox.y + canvasBox.height - insets.bottom,
    );

    await page.locator(`${CANVAS} .djs-context-pad [data-action="delete"]`).click();
    await expect(page.locator(`[data-element-id="${CORNER_TEAM}"]`)).toHaveCount(0);
  });
});
