import { test, type Page } from "@playwright/test";

import type { ShellHost } from "../src/index.js";
import { registerShellConformance, type ShellConformanceHarness } from "../src/testing.js";
import { demoHarness } from "./demo-harness.js";
import { webDemoHarness } from "./web-harness.js";

// The kit against the demo pages, as a modeler's e2e suite runs it against its webview or its web
// app: the IDE and embedded hosts on the 0.1 demo, the web host on the web demo (/web.html, the
// whole web column). The demos feed every hook or declare it absent, so a skip is a failure here.
const suites: ReadonlyArray<{ title: string; host: ShellHost; harness: ShellConformanceHarness<Page> }> = [
  { title: "ide host", host: "ide", harness: demoHarness("ide") },
  { title: "web host", host: "web", harness: webDemoHarness() },
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
    harness: webDemoHarness({ themes: ["light", "dark"] }),
  },
  // a modeler without legend and inspector declares them absent: nothing is skipped, nothing shows
  {
    title: "ide host, modeler without legend and inspector",
    host: "ide",
    harness: demoHarness("ide", { without: ["legend", "inspector"] }),
  },
];

for (const { title, host, harness } of suites) {
  test.describe(title, () => {
    test.describe.configure({ timeout: 60_000 });
    registerShellConformance(harness, test, {
      onSkip(caseName, skips) {
        const reasons = skips.map((skip) => `${skip.hook}: ${skip.reason}`).join("; ");
        throw new Error(`the demo harness left "${caseName}" (${host} host) unverified: ${reasons}`);
      },
    });
  });
}
