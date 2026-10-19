import { test, type Page } from "@playwright/test";
import { registerShellConformance, type ShellSkip } from "@miragon/modeler-shell/testing";
import { SAMPLE_DOCUMENT, serializeDocumentText } from "@miragon/context-maps-schema-model";
import { THEMES } from "../../apps/webapp/src/themes.js";
import { mapLink, waitForApp } from "./support/app.js";
import { MAP_WITH_FINDINGS } from "./support/maps.js";

/**
 * The shell's conformance kit against the real web app (the web host of guide §5.2): geometry at
 * three sizes with the primary action, the legal line, the legend and the raised zoom row, ARIA
 * and keyboard models, keyboard creation from the palette, the light-only mode under any system
 * setting, the start screen, toasts, the problems list with rows that select their relationship,
 * the drop zone and a clean teardown. The web app has no inspector and no invalid-file state (it
 * edits no text, and a file it cannot read leaves the map as it was), so the harness declares both
 * absent; any skip fails the suite.
 */
const describeSkips = (skips: readonly ShellSkip[]): string =>
  skips.map((skip) => `${skip.hook}: ${skip.reason}`).join("; ");

/** Pages that start every visit without the browser's copy of a map or a legend state. */
const freshPages = new WeakSet<Page>();

test.describe("web app: shell conformance", () => {
  test.describe.configure({ timeout: 90_000 });

  registerShellConformance<Page>(
    {
      host: "web",
      themes: THEMES,
      // The kit emulates the system's colour scheme and contrast before every open.
      async open(page, { size }) {
        if (!freshPages.has(page)) {
          freshPages.add(page);
          await page.addInitScript(() => {
            try {
              localStorage.clear();
            } catch {
              // A blocked storage holds no map either.
            }
          });
        }
        await page.setViewportSize(size);
        await page.goto(mapLink(SAMPLE_DOCUMENT));
        await waitForApp(page);
      },
      async destroy(page) {
        await page.evaluate(() => window.__contextMapsApp?.destroy());
      },
      absent: ["inspector", "invalid"],
      show: {
        async legend(page) {
          await page.evaluate(() => window.__contextMapsApp?.shell.legend?.setOpen(true));
        },
        // A link to a map with findings of the semantic rules: the pill and its list, each row on
        // the relationship it concerns.
        async problems(page) {
          await page.goto(mapLink(MAP_WITH_FINDINGS));
          await waitForApp(page);
        },
        async status(page) {
          await page.evaluate(() => {
            const shell = window.__contextMapsApp!.shell;
            shell.setStatus({
              severity: "danger",
              text: shell.messages.invalidFile("context map"),
            });
          });
        },
        // A fresh visit: the page without a map in its link or in the browser's copy.
        async emptyState(page) {
          await page.goto("/");
          await waitForApp(page);
        },
        async toast(page, { status, text, actionLabel }) {
          await page.evaluate(
            ({ status, text, actionLabel }) => {
              window.__contextMapsApp?.shell.toast({
                status,
                text,
                ...(actionLabel ? { action: { label: actionLabel, onSelect() {} } } : {}),
              });
            },
            { status, text, actionLabel },
          );
        },
      },
      drop: {
        accepted: {
          name: "conference.cm.json",
          type: "application/json",
          text: serializeDocumentText(SAMPLE_DOCUMENT),
        },
        rejected: { name: "map.png", type: "image/png", text: "x" },
      },
    },
    test,
    {
      onSkip(caseName, skips) {
        throw new Error(`shell conformance "${caseName}" skipped: ${describeSkips(skips)}`);
      },
    },
  );
});
