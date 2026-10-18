import { expect, test, type Page } from "@playwright/test";

/*
 * Typography and host hygiene of the chrome (guide §5.4, §5.6, §5.8, §5.14, §13.5) in the demo's
 * stubbed VS Code webview, whose default stylesheet sits in @layer vscode-default as in VS Code.
 * The conformance kit measures boxes; these are the computed styles it does not look at.
 */

async function open(page: Page, query = ""): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/?host=ide${query}`);
  await page.waitForFunction(() => window.__demo?.ready === true);
}

function styleOf(page: Page, selector: string, properties: readonly string[]) {
  return page.evaluate(
    ({ selector, properties }) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`no ${selector}`);
      const style = getComputedStyle(element);
      return Object.fromEntries(properties.map((property) => [property, style.getPropertyValue(property)]));
    },
    { selector, properties },
  );
}

const GEIST = /^"Geist Variable"/;
const GEIST_MONO = /^"Geist Mono Variable"/;

test.describe("chrome typography and host hygiene", () => {
  test("the own-document reset beats VS Code's default webview styles", async ({ page }) => {
    await open(page);
    const body = await styleOf(page, "body", ["padding-left", "margin-left", "font-family", "font-size"]);
    expect(body["padding-left"]).toBe("0px");
    expect(body["margin-left"]).toBe("0px");
    expect(body["font-family"]).toMatch(GEIST);
    expect(body["font-size"]).toBe("13px");
  });

  test("the zoom readout is 13px/600 with tabular numbers, the buttons use the chrome font", async ({
    page,
  }) => {
    await open(page);
    const readout = await styleOf(page, ".cd-shell-zoom-readout", [
      "font-family",
      "font-size",
      "font-weight",
      "font-variant-numeric",
    ]);
    expect(readout).toEqual({
      "font-family": expect.stringMatching(GEIST),
      "font-size": "13px",
      "font-weight": "600",
      "font-variant-numeric": "tabular-nums",
    });
    const trigger = await styleOf(page, '[data-chrome="menu"]', ["font-family", "font-size"]);
    expect(trigger["font-family"]).toMatch(GEIST);
    expect(trigger["font-size"]).toBe("13px");
  });

  test("menu entries are 13px/400 and at least 36px high", async ({ page }) => {
    await open(page);
    await page.locator('[data-chrome="menu"]').click();
    const entry = await styleOf(page, ".cd-shell-menu-item", ["font-size", "font-weight", "min-height"]);
    expect(entry).toEqual({ "font-size": "13px", "font-weight": "400", "min-height": "36px" });
  });

  test("the tooltip's shortcut chip keeps the guide's kbd, not the host's", async ({ page }) => {
    await open(page);
    await page.locator('[data-zoom="in"]').hover();
    await expect(page.locator(".cd-shell-tooltip")).toBeVisible();
    const tooltip = await styleOf(page, ".cd-shell-tooltip", ["font-size", "line-height", "font-weight"]);
    expect(tooltip).toEqual({ "font-size": "13px", "line-height": "20px", "font-weight": "400" });
    const chip = await styleOf(page, ".cd-shell-tooltip .cd-shell-kbd", [
      "font-family",
      "box-shadow",
      "vertical-align",
      "padding-left",
    ]);
    expect(chip).toEqual({
      "font-family": expect.stringMatching(GEIST_MONO),
      "box-shadow": "none",
      "vertical-align": "baseline",
      "padding-left": "6px",
    });
  });

  test("the empty-file hint's Insert example is a 36px ghost button at 600", async ({ page }) => {
    await open(page, "&empty");
    const action = await styleOf(page, ".cd-shell-hint-action", ["font-weight", "height", "font-family"]);
    expect(action["font-weight"]).toBe("600");
    expect(action.height).toBe("36px");
    expect(action["font-family"]).toMatch(GEIST);
  });
});
