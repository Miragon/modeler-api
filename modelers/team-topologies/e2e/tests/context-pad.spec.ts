import { expect, test, type Page } from "@playwright/test";
import { diagramLink } from "./support/app.js";
import { CANVAS, centreOf, gotoApp } from "./support/modeler.js";

/**
 * The web app hands the renderer the shell's fit insets as its free area, so the context pad of a
 * team in the bottom right corner stays inside it, clear of the shell's islands (guide §5.13:
 * nothing on the canvas lies above an island, so an island would hide the pad's entries). The
 * inspector's glide aims at the same free area, so the pad keeps its place right of the team.
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

/** Where the open pad stands, measured as diagram-js measures its element (outline included). */
interface PadPlacement {
  beside: "right" | "left" | "over";
  topAlignedWithShape: boolean;
  insideFreeArea: boolean;
  /** The entries that are not the topmost element at their centre, so no pointer reaches them. */
  unreachable: string[];
}

function padPlacement(page: Page, elementId: string): Promise<PadPlacement | undefined> {
  return page.evaluate(
    ([canvas, id]) => {
      const container = document.querySelector(canvas);
      const pad = container?.querySelector(".djs-context-pad.open");
      const shape = container?.querySelector(`[data-element-id="${id}"]`);
      if (!container || !pad || !shape) return undefined;
      const canvasBox = container.getBoundingClientRect();
      const padBox = pad.getBoundingClientRect();
      const shapeBox = shape.getBoundingClientRect();
      const insets = window.__ttApp!.shell.fitInsets();
      const beside: PadPlacement["beside"] =
        padBox.left >= shapeBox.right ? "right" : padBox.right <= shapeBox.left ? "left" : "over";
      return {
        beside,
        topAlignedWithShape: Math.abs(padBox.top - shapeBox.top) < 1,
        insideFreeArea:
          padBox.left >= canvasBox.left + insets.left &&
          padBox.top >= canvasBox.top + insets.top &&
          padBox.right <= canvasBox.right - insets.right &&
          padBox.bottom <= canvasBox.bottom - insets.bottom,
        unreachable: [...pad.querySelectorAll<HTMLElement>(".entry")]
          .filter((entry) => {
            const box = entry.getBoundingClientRect();
            const hit = document.elementFromPoint(
              box.left + box.width / 2,
              box.top + box.height / 2,
            );
            return hit?.closest(".entry") !== entry;
          })
          .map((entry) => entry.getAttribute("data-action") ?? ""),
      };
    },
    [CANVAS, elementId] as const,
  );
}

/** Resolves once the shape has kept still for 20 frames: the inspector's glide (250ms) is over. */
function shapeAtRest(page: Page, elementId: string): Promise<void> {
  return page.evaluate(
    ([canvas, id]) =>
      new Promise<void>((resolve) => {
        const shape = document.querySelector(`${canvas} [data-element-id="${id}"]`);
        if (!shape) return resolve();
        let lastPosition = "";
        let stillFrames = 0;
        const sample = () => {
          const box = shape.getBoundingClientRect();
          const position = `${box.left},${box.top}`;
          stillFrames = position === lastPosition ? stillFrames + 1 : 0;
          lastPosition = position;
          if (stillFrames >= 20) resolve();
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }),
    [CANVAS, elementId] as const,
  );
}

async function selectCornerTeam(page: Page): Promise<void> {
  const corner = await centreOf(page, CORNER_TEAM);
  await page.mouse.click(corner.x, corner.y);
  await expect(page.locator(`${CANVAS} .djs-context-pad.open .entry`)).toHaveCount(3);
  await expect(page.locator('[data-chrome="inspector"]')).toBeVisible();
  await shapeAtRest(page, CORNER_TEAM);
}

test.describe("webapp: context pad", () => {
  test("a team in the bottom right corner keeps every pad entry reachable", async ({ page }) => {
    await gotoApp(page, diagramLink(CORNERS_DOCUMENT));
    await selectCornerTeam(page);

    // The inspector's glide makes room left of the side panel, and the pad uses it.
    await expect
      .poll(() => padPlacement(page, CORNER_TEAM))
      .toMatchObject({
        beside: "right",
        insideFreeArea: true,
        unreachable: [],
      });

    await page.locator(`${CANVAS} .djs-context-pad [data-action="delete"]`).click();
    await expect(page.locator(`[data-element-id="${CORNER_TEAM}"]`)).toHaveCount(0);
  });

  test("at 720 × 520 the bottom sheet's glide leaves the pad beside its team", async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 520 });
    await gotoApp(page, diagramLink(CORNERS_DOCUMENT));
    await selectCornerTeam(page);

    await expect
      .poll(() => padPlacement(page, CORNER_TEAM))
      .toEqual({
        beside: "right",
        topAlignedWithShape: true,
        insideFreeArea: true,
        unreachable: [],
      });
  });
});
