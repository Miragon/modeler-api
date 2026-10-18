import { expect, test, type Page } from "@playwright/test";

import { shellConformanceCases, type ShellConformanceHarness } from "../src/testing.js";
import { demoHarness } from "./demo-harness.js";

/*
 * The kit's own proof: each saboteur breaks the demo at runtime in one way the guide forbids, and
 * the case that encodes the rule must fail with the matching problem. A rule whose case passes a
 * saboteur is a rule the kit does not actually enforce.
 */

const WIDE_ONLY = [{ width: 1280, height: 900 }] as const;

function runCase(name: string, page: Page, harness: ShellConformanceHarness<Page>) {
  const found = shellConformanceCases().find((conformanceCase) => conformanceCase.name === name);
  if (!found) throw new Error(`no conformance case "${name}"`);
  return found.run(page, harness);
}

/** The demo harness with `sabotage` applied right after every open. */
function sabotaged(
  sabotage: () => void,
  host: "ide" | "web" | "embedded" = "ide",
): ShellConformanceHarness<Page> {
  const harness = demoHarness(host);
  return {
    ...harness,
    sizes: WIDE_ONLY,
    async open(page, context) {
      await harness.open(page, context);
      await page.evaluate(sabotage);
    },
  };
}

test.describe("saboteurs", () => {
  test.describe.configure({ timeout: 60_000 });

  test("geometry fails for an island 2px off its anchor", async ({ page }) => {
    const harness = sabotaged(() => {
      document.querySelector<HTMLElement>('[data-chrome="zoom"]')!.style.translate = "-2px 0";
    });
    await expect(runCase("geometry", page, harness)).rejects.toThrow(
      /\[1280 × 900, as opened\] zoom: right is 14px, expected 12px \(±1px\)/,
    );
  });

  test("geometry fails for a dropdown and a tooltip off their anchors", async ({ page }) => {
    const harness = sabotaged(() => {
      const style = document.createElement("style");
      style.textContent = '[role="menu"], [role="tooltip"] { translate: 0 3px; }';
      document.head.append(style);
    });
    const failure = await runCase("geometry", page, harness).then(
      () => "passed",
      (error: unknown) => String(error),
    );
    expect(failure).toMatch(/\[1280 × 900\] dropdown: top is 63px, expected 60px \(±1px\)/);
    expect(failure).toMatch(/\[1280 × 900\] tooltip: top is 63px, expected 60px \(±1px\) \(on menu\)/);
    expect(failure).toMatch(/\[1280 × 900\] tooltip: bottom is 57px, expected 60px \(±1px\) \(on zoom-in\)/);
  });

  test("aria fails for a positive tabindex", async ({ page }) => {
    const harness = sabotaged(() => {
      document.querySelector('[data-chrome="menu"]')!.setAttribute("tabindex", "1");
    });
    await expect(runCase("aria", page, harness)).rejects.toThrow(
      /positive tabindex on button.*\[data-chrome="menu"\] \(tabindex="1"\)/,
    );
  });

  test("keys fails when a handled key reaches a keydown listener on window", async ({ page }) => {
    const harness = sabotaged(() => {
      const ignore = () => {};
      Event.prototype.stopPropagation = ignore;
      Event.prototype.stopImmediatePropagation = ignore;
    });
    await expect(runCase("keys", page, harness)).rejects.toThrow(
      /Control\+Equal on the canvas reached a keydown listener on window/,
    );
  });

  test("keys fails when a zoom key acts twice", async ({ page }) => {
    const harness = sabotaged(() => {
      document.addEventListener("keydown", (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "=")
          window.__demo?.connection.viewport.stepZoom(1);
      });
    });
    await expect(runCase("keys", page, harness)).rejects.toThrow(
      /Control\+Equal on the canvas zoomed to 182% from 100%, expected 135% \(exactly one step\)/,
    );
  });

  test("keys fails when a document undo binding takes Cmd/Ctrl+Z from a text field", async ({ page }) => {
    // Event Storming binds undo on document; registered before the kit's recorders, as a modeler's is
    const harness = sabotaged(() => {
      document.addEventListener("keydown", (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") event.preventDefault();
      });
    });
    await expect(runCase("keys", page, harness)).rejects.toThrow(
      /Control\+KeyZ in a text field was prevented; the shell only stops it/,
    );
  });

  test("keys fails when a key outside the IDE host is not prevented", async ({ page }) => {
    const harness = sabotaged(() => {
      const original = Event.prototype.preventDefault;
      Event.prototype.preventDefault = function (this: Event) {
        if (!(this instanceof KeyboardEvent && this.key === "=")) original.call(this);
      };
    }, "web");
    await expect(runCase("keys", page, harness)).rejects.toThrow(
      /Control\+Equal on the canvas arrived unprevented; a handled key calls preventDefault/,
    );
  });

  test("appearance fails for a dark subtree under a light-only modeler", async ({ page }) => {
    const harness = sabotaged(() => {
      document.querySelector('[data-chrome="zoom"]')!.setAttribute("data-cd-theme", "dark");
    });
    await expect(runCase("appearance", page, harness)).rejects.toThrow(
      /\[requested dark\] div.*\[data-chrome="zoom"\] carries data-cd-theme="dark": a second mode inside the modeler is half-dark/,
    );
  });

  test("cleanup fails for an element left after destroy", async ({ page }) => {
    const harness: ShellConformanceHarness<Page> = {
      ...demoHarness("ide"),
      async destroy(page) {
        await page.evaluate(() => {
          const zoom = document.querySelector('[data-chrome="zoom"]');
          window.__demo?.destroy();
          if (zoom) document.body.append(zoom);
        });
      },
    };
    await expect(runCase("cleanup", page, harness)).rejects.toThrow(
      /\[data-chrome="zoom"\] is left after destroy/,
    );
  });

  test("cleanup fails for a key listener that survives destroy", async ({ page }) => {
    const harness: ShellConformanceHarness<Page> = {
      ...demoHarness("ide"),
      async destroy(page) {
        await page.evaluate(() => {
          window.__demo?.destroy();
          document.addEventListener("keydown", (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "=") event.preventDefault();
          });
        });
      },
    };
    await expect(runCase("cleanup", page, harness)).rejects.toThrow(
      /Control\+Equal after destroy arrived prevented: a shell listener is still installed/,
    );
  });
});
