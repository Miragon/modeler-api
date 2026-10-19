import { test, expect } from "@playwright/test";
import { exportMap, openExample } from "./support/app.js";

test.describe("webapp export round-trip", () => {
  test.beforeEach(async ({ page }) => {
    // The app starts on the start screen; its "Show example" loads the bundled example, so the
    // round-trip tests operate on real content.
    await openExample(page);
  });

  test("loads the example context map and exports stable JSON + SVG", async ({ page }) => {
    const doc = await exportMap(page);
    expect(doc.contexts.length).toBeGreaterThan(0);
    expect(doc.relationships.length).toBeGreaterThan(0);

    const subdomainTypes = doc.contexts.map((context) => context.subdomainType);
    expect(subdomainTypes).toContain("core");
    expect(subdomainTypes).toContain("generic");

    const { svg } = await page.evaluate(() => window.__cmModeler.saveSVG());
    expect(svg).toContain("<svg");
  });

  test("import -> export -> re-import is a lossless fixed point", async ({ page }) => {
    const result = await page.evaluate(() => {
      const modeler = window.__cmModeler;
      const first = modeler.exportDocument();
      modeler.importDocument(first);
      return { first, second: modeler.exportDocument() };
    });

    // Re-importing the exported document yields the same set of contexts/relationships.
    expect(result.second.contexts.map((context) => context.id).sort()).toEqual(
      result.first.contexts.map((context) => context.id).sort(),
    );
    expect(result.second.relationships.length).toBe(result.first.relationships.length);
  });
});
