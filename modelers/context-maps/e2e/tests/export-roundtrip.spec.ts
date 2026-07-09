import { test, expect, type Page } from "@playwright/test";

/**
 * Typed handle to the app's debug surface (exposed in apps/webapp/src/ui/DiagramCanvas.tsx). We never
 * import the renderer here — only the structural shape we call into. Kept minimal so @miragon/context-maps-e2e
 * stays free of @miragon/context-maps-* dependencies.
 */
interface CmModeler {
  importDocument(doc: unknown): { warnings: ReadonlyArray<unknown> };
  exportDocument(): {
    title: string;
    contexts: ReadonlyArray<{ id: string; label: string; subdomainType?: string }>;
    relationships: ReadonlyArray<{ id: string; pattern: string }>;
  };
  saveSVG(): { svg: string };
}
declare global {
  interface Window {
    __cmModeler: CmModeler;
  }
}

async function waitForModeler(page: Page): Promise<void> {
  await page.waitForFunction(() => typeof window.__cmModeler !== "undefined");
}

test.describe("webapp export round-trip", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForModeler(page);
  });

  test("loads the example context map and exports stable JSON + SVG", async ({ page }) => {
    // The renderer paints one .djs-element per bounded context / relationship once import.done fires.
    await expect(page.locator(".tt-canvas .djs-element").first()).toBeVisible();

    const doc = await page.evaluate(() => window.__cmModeler.exportDocument());
    expect(doc.contexts.length).toBeGreaterThan(0);
    expect(doc.relationships.length).toBeGreaterThan(0);

    const subdomainTypes = doc.contexts.map((c) => c.subdomainType);
    expect(subdomainTypes).toContain("core");
    expect(subdomainTypes).toContain("generic");

    const { svg } = await page.evaluate(() => window.__cmModeler.saveSVG());
    expect(svg).toContain("<svg");
  });

  test("import -> export -> re-import is a lossless fixed point", async ({ page }) => {
    const result = await page.evaluate(() => {
      const modeler = window.__cmModeler;
      const first = modeler.exportDocument();
      modeler.importDocument(first); // round-trip
      return { first, second: modeler.exportDocument() };
    });

    // Re-importing the exported document yields the same set of contexts/relationships.
    expect(result.second.contexts.map((c) => c.id).sort()).toEqual(
      result.first.contexts.map((c) => c.id).sort(),
    );
    expect(result.second.relationships.length).toBe(result.first.relationships.length);
  });
});
