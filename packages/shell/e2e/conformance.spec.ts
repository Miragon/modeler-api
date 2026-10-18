import { test, type Page } from "@playwright/test";

import { registerShellConformance } from "../src/testing.js";

// The kit against the demo page, as a modeler's e2e suite would run it against its webview.
registerShellConformance(
  {
    host: "ide",
    themes: ["light"],
    async open(page: Page, { size, requested }) {
      await page.setViewportSize(size);
      const query = new URLSearchParams({ host: "ide", themes: "light", theme: requested.theme });
      if (requested.kontrast) query.set("kontrast", requested.kontrast);
      await page.goto(`/?${query.toString()}`);
      await page.waitForFunction(() => window.__demo?.ready === true);
    },
    async destroy(page: Page) {
      await page.evaluate(() => window.__demo?.destroy());
    },
  },
  test,
);
