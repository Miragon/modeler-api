import { test } from "@playwright/test";

import { registerShellConformance } from "../src/testing.js";
import { EXPECTED_SKIPS, demoHarness } from "./demo-harness.js";

// The kit against the demo page, as a modeler's e2e suite runs it against its webview. The demo
// feeds every hook, so a skip is a failure here unless the host cannot provide the input yet.
for (const host of ["ide", "web", "embedded"] as const) {
  test.describe(`${host} host`, () => {
    test.describe.configure({ timeout: 60_000 });
    registerShellConformance(demoHarness(host), test, {
      onSkip(caseName, reason) {
        const expected = EXPECTED_SKIPS[host] ?? [];
        if (!expected.some((pattern) => pattern.test(reason))) {
          throw new Error(`the demo harness left "${caseName}" unverified: ${reason}`);
        }
      },
    });
  });
}
