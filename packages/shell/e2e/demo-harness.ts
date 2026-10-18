import type { Page } from "@playwright/test";

import type { Appearance, ShellHost, Theme } from "../src/index.js";
import { vsCodeStubSearch, type ShellConformanceHarness } from "../src/testing.js";
import { colorThemeKindOf } from "../src/testing-vscode-stub.js";

/**
 * What the demo's foreign page (demo.css) puts around the embedded root's container: 40px page
 * padding and the root's own 1px border on each side.
 */
const EMBEDDED_FRAME = { width: 2 * 40 + 2 * 1, height: 2 * 40 + 2 * 1 } as const;

export interface DemoHarnessOptions {
  /** The modes the demo modeler declares; default `["light"]`, as every modeler today. */
  themes?: readonly Theme[];
  /**
   * `ide` only: open under VS Code Light and switch the stubbed host to the requested color theme
   * at runtime, so the mode arrives through the theme bridge instead of the initial HTML.
   */
  switchAtRuntime?: boolean;
}

const LIGHT: Appearance = { theme: "light" };

/**
 * The kit's harness for the demo page, as a modeler's e2e suite writes it for its webview: the
 * demo mounts legend and inspector slots, the show hooks open them through `window.__demo.shell`.
 */
export function demoHarness(
  host: ShellHost,
  options: DemoHarnessOptions = {},
): ShellConformanceHarness<Page> {
  const themes = options.themes ?? ["light"];
  const switchAtRuntime = options.switchAtRuntime === true && host === "ide";
  return {
    host,
    themes,
    async open(page, { size, requested }) {
      // the embedded root sits inside a framed foreign page; grow the page so the container gets `size`
      const frame = host === "embedded" ? EMBEDDED_FRAME : { width: 0, height: 0 };
      await page.setViewportSize({ width: size.width + frame.width, height: size.height + frame.height });
      const initial = switchAtRuntime ? LIGHT : requested;
      const query = new URLSearchParams(vsCodeStubSearch(initial));
      query.set("host", host);
      query.set("themes", themes.join(","));
      query.set("legend", "");
      query.set("inspector", "");
      await page.goto(`/?${query.toString()}`);
      await page.waitForFunction(() => window.__demo?.ready === true);
      if (!switchAtRuntime) return;
      await page.evaluate(
        (kind) => window.__demo?.vscode?.setColorThemeKind(kind),
        colorThemeKindOf(requested),
      );
      await page.waitForFunction(
        () =>
          window.__demo?.vscode?.pendingMessages() === 0 &&
          !document.documentElement.classList.contains("cd-shell-no-transition"),
      );
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
