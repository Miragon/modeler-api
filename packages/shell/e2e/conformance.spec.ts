import { test, type Page } from "@playwright/test";

import type { ShellHost } from "../src/index.js";
import { registerShellConformance, type ShellConformanceHarness } from "../src/testing.js";
import { EXPECTED_SKIPS, demoHarness } from "./demo-harness.js";

// The kit against the demo page, as a modeler's e2e suite runs it against its webview. The demo
// feeds every hook, so a skip is a failure here unless the host cannot provide the input yet.
const suites: ReadonlyArray<{ title: string; host: ShellHost; harness: ShellConformanceHarness<Page> }> = [
  { title: "ide host", host: "ide", harness: demoHarness("ide") },
  { title: "web host", host: "web", harness: demoHarness("web") },
  { title: "embedded host", host: "embedded", harness: demoHarness("embedded") },
  // the modeler of the shared dark-mode release: the same rules, the requested dark now shows
  {
    title: "ide host, dark-capable modeler",
    host: "ide",
    harness: demoHarness("ide", { themes: ["light", "dark"] }),
  },
  {
    title: "web host, dark-capable modeler",
    host: "web",
    harness: demoHarness("web", { themes: ["light", "dark"] }),
  },
];

for (const { title, host, harness } of suites) {
  test.describe(title, () => {
    test.describe.configure({ timeout: 60_000 });
    registerShellConformance(harness, test, {
      onSkip(caseName, reason) {
        const expected = EXPECTED_SKIPS[host] ?? [];
        if (!expected.some((pattern) => pattern.test(reason))) {
          throw new Error(`the demo harness left "${caseName}" unverified: ${reason}`);
        }
      },
    });
  });
}
