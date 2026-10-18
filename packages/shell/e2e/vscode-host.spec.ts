import { expect, test, type Page } from "@playwright/test";

import { shellConformanceCases } from "../src/testing.js";
import { demoHarness } from "./demo-harness.js";

/*
 * The demo's `ide` host stands in for VS Code: <html> from renderWebviewHtml, the host page's body
 * classes and the real theme bridge posting to the webview. These specs switch the color theme
 * while the webview runs, the path the conformance kit's own appearance case (fresh page per
 * request) does not take.
 */

const appearanceCase = shellConformanceCases().find(
  (conformanceCase) => conformanceCase.name === "appearance",
);
const WIDE_ONLY = [{ width: 1280, height: 900 }] as const;

async function openIde(page: Page, themes: string, theme = "light"): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/?host=ide&themes=${themes}&theme=${theme}`);
  await page.waitForFunction(() => window.__demo?.ready === true);
}

async function switchTo(page: Page, kind: 1 | 2 | 3 | 4): Promise<void> {
  await page.evaluate((next) => window.__demo?.vscode?.setColorThemeKind(next), kind);
  await page.waitForFunction(
    () =>
      window.__demo?.vscode?.pendingMessages() === 0 &&
      !document.documentElement.classList.contains("cd-shell-no-transition"),
  );
}

function htmlMode(page: Page) {
  return page.evaluate(() => ({
    theme: document.documentElement.getAttribute("data-cd-theme"),
    kontrast: document.documentElement.getAttribute("data-cd-kontrast"),
    body: document.body.className,
  }));
}

test.describe("VS Code host stub", () => {
  test.describe.configure({ timeout: 60_000 });

  test("the appearance case holds after a runtime theme switch (light-only modeler)", async ({ page }) => {
    await appearanceCase!.run(page, {
      ...demoHarness("ide", { switchAtRuntime: true }),
      sizes: WIDE_ONLY,
    });
  });

  test("the appearance case holds after a runtime theme switch (dark-capable modeler)", async ({ page }) => {
    await appearanceCase!.run(page, {
      ...demoHarness("ide", { themes: ["light", "dark"], switchAtRuntime: true }),
      sizes: WIDE_ONLY,
    });
  });

  test("a light-only modeler stays light whatever VS Code reports, high contrast passes", async ({
    page,
  }) => {
    await openIde(page, "light", "dark");
    expect(await htmlMode(page)).toEqual({ theme: "light", kontrast: null, body: "vscode-dark" });
    await switchTo(page, 3);
    expect(await htmlMode(page)).toEqual({ theme: "light", kontrast: "hoch", body: "vscode-high-contrast" });
    await switchTo(page, 4);
    expect(await htmlMode(page)).toEqual({
      theme: "light",
      kontrast: "hoch",
      body: "vscode-high-contrast-light vscode-high-contrast",
    });
    await switchTo(page, 2);
    expect(await htmlMode(page)).toEqual({ theme: "light", kontrast: null, body: "vscode-dark" });
  });

  test("a dark-capable modeler switches both attributes in one step and fades no colour", async ({
    page,
  }) => {
    await openIde(page, "light,dark");
    await page.evaluate(() => {
      const record = { batches: [] as string[][], transitions: 0 };
      (window as unknown as { __switch: typeof record }).__switch = record;
      new MutationObserver((mutations) => {
        record.batches.push(
          mutations
            .filter((mutation) => mutation.attributeName?.startsWith("data-cd-"))
            .map((mutation) => mutation.attributeName ?? ""),
        );
      }).observe(document.documentElement, { attributes: true });
      document.addEventListener("transitionrun", () => record.transitions++, true);
    });
    await switchTo(page, 3);
    await page.waitForTimeout(300);
    const record = await page.evaluate(
      () => (window as unknown as { __switch: { batches: string[][]; transitions: number } }).__switch,
    );
    expect(await htmlMode(page)).toEqual({ theme: "dark", kontrast: "hoch", body: "vscode-high-contrast" });
    expect(record.batches.filter((batch) => batch.length > 0)).toEqual([
      ["data-cd-theme", "data-cd-kontrast"],
    ]);
    expect(record.transitions).toBe(0);
  });
});
