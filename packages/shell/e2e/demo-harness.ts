import type { Page } from "@playwright/test";

import type { ShellHost } from "../src/index.js";
import type { ShellConformanceHarness } from "../src/testing.js";

/**
 * What the demo's foreign page (demo.css) puts around the embedded root: the browser's 8px body
 * margin and 40px padding on both sides; the root's 1px border lies outside its 100% box.
 */
const EMBEDDED_FRAME = { width: 2 * 8 + 2 * 40, height: 2 * 40 } as const;

/**
 * The kit's harness for the demo page, as a modeler's e2e suite writes it for its webview: the
 * demo mounts legend and inspector slots, the show hooks open them through `window.__demo.shell`.
 */
export function demoHarness(host: ShellHost): ShellConformanceHarness<Page> {
  return {
    host,
    themes: ["light"],
    async open(page, { size, requested }) {
      // the embedded root sits inside a framed foreign page; grow the page so the container gets `size`
      const frame = host === "embedded" ? EMBEDDED_FRAME : { width: 0, height: 0 };
      await page.setViewportSize({ width: size.width + frame.width, height: size.height + frame.height });
      const query = new URLSearchParams({ host, themes: "light", theme: requested.theme });
      if (requested.kontrast) query.set("kontrast", requested.kontrast);
      query.set("legend", "");
      query.set("inspector", "");
      await page.goto(`/?${query.toString()}`);
      await page.waitForFunction(() => window.__demo?.ready === true);
    },
    async destroy(page) {
      await page.evaluate(() => window.__demo?.destroy());
    },
    show: {
      async problems(page) {
        await page.evaluate(() => window.__demo?.shell.setProblems({ count: 2, errors: 1 }));
      },
      async status(page) {
        await page.evaluate(() => {
          const shell = window.__demo?.shell;
          shell?.setStatus({ severity: "danger", text: shell.messages.invalidFile("demo diagram") });
        });
      },
      async legend(page) {
        await page.evaluate(() => window.__demo?.shell.legend?.setOpen(true));
      },
      async inspector(page) {
        await page.evaluate(() => window.__demo?.shell.inspector?.open());
      },
    },
  };
}

/** Until contract 1.1 an embedded modeler has no appearance channel (guide §13.3). */
export const EXPECTED_SKIPS: Readonly<Partial<Record<ShellHost, readonly RegExp[]>>> = {
  embedded: [/high contrast not verified/],
};
