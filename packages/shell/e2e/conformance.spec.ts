import { test, type Page } from "@playwright/test";

import type { ShellHost } from "../src/index.js";
import { registerShellConformance, type ShellConformanceHarness } from "../src/testing.js";
import { demoHarness } from "./demo-harness.js";

// The kit against the demo page, as a modeler's e2e suite runs it against its webview. The demo
// feeds every hook, so a skip is a failure here.
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
        throw new Error(`the demo harness left "${caseName}" (${host} host) unverified: ${reason}`);
      },
    });
  });
}
