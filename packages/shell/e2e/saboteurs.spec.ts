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

/** Runs every case; the failure (or skips) of each case that did not pass, by case name. */
async function failures(page: Page, harness: ShellConformanceHarness<Page>): Promise<Map<string, string>> {
  const failed = new Map<string, string>();
  for (const conformanceCase of shellConformanceCases()) {
    try {
      const outcome = await conformanceCase.run(page, harness);
      const skipped = outcome?.skipped ?? [];
      if (skipped.length > 0) {
        failed.set(conformanceCase.name, `skipped: ${skipped.map((skip) => skip.reason).join("; ")}`);
      }
    } catch (error) {
      failed.set(conformanceCase.name, String(error));
    }
  }
  return failed;
}

/** The saboteur breaks exactly one rule: `caseName` fails with every pattern, all other cases pass. */
async function expectOnlyCaseFails(
  page: Page,
  harness: ShellConformanceHarness<Page>,
  caseName: string,
  patterns: readonly RegExp[],
): Promise<void> {
  const failed = await failures(page, harness);
  expect([...failed.entries()].filter(([name]) => name !== caseName)).toEqual([]);
  const failure = failed.get(caseName);
  expect(failure, `"${caseName}" passed the saboteur`).toBeDefined();
  for (const pattern of patterns) expect(failure).toMatch(pattern);
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

  test.describe("that break one rule and fail only its case", () => {
    test.describe.configure({ timeout: 150_000 });

    test("create fails when Enter on a creating palette entry places nothing", async ({ page }) => {
      const harness = sabotaged(() => {
        window.__demo!.flaws.noKeyboardCreate = true;
      });
      await expectOnlyCaseFails(page, harness, "create", [
        /create: Enter on palette entry "create\.box" added no element/,
      ]);
    });

    test("readOnly fails when the lock leaves the canvas editable", async ({ page }) => {
      const harness = sabotaged(() => {
        window.__demo!.flaws.canvasUnlocked = true;
      });
      await expectOnlyCaseFails(page, harness, "readOnly", [
        /read-only: selecting "[^"]+" shows the context pad/,
        /read-only: a 40px drag changed "[^"]+"/,
        /read-only: Delete on the canvas deleted "[^"]+"/,
      ]);
    });

    test("keys fails in the IDE host when Cmd/Ctrl+A on the canvas goes on to VS Code", async ({ page }) => {
      const harness = sabotaged(() => {
        window.__demo!.flaws.noSelectAll = true;
      });
      await expectOnlyCaseFails(page, harness, "keys", [
        /Control\+KeyA on the canvas \(select all acts on the canvas only\) reached a keydown listener on window/,
        /Meta\+KeyA on the canvas \(select all acts on the canvas only\) reached a keydown listener on window/,
      ]);
    });

    test("appearance fails for a canvas surround painted outside the mode", async ({ page }) => {
      // Event Storming's `style dark` board: navy around a light modeler
      const harness = sabotaged(() => {
        const style = document.createElement("style");
        style.textContent = ".cd-shell-canvas, .djs-container { background-color: #080A20 !important; }";
        document.head.append(style);
      });
      await expectOnlyCaseFails(page, harness, "appearance", [
        /\[requested dark\] canvas surround: div\.djs-container\S* paints rgb\(8, 10, 32\), but --cd-ui-grund resolves to rgb\(/,
      ]);
    });

    test("appearance fails for a renderer colour on the armed tool's icon", async ({ page }) => {
      // the lasso icon of Event Storming computed to rgb(29, 30, 33) from a renderer rule
      const harness = sabotaged(() => {
        const style = document.createElement("style");
        style.textContent =
          '.djs-palette .entry[aria-pressed="true"] svg { color: rgb(29, 30, 33) !important; }';
        document.head.append(style);
      });
      await expectOnlyCaseFails(page, harness, "appearance", [
        /palette: the <svg> icon of tool "lasso-tool" pressed has color rgb\(29, 30, 33\), expected --cd-ui-text/,
      ]);
    });
  });

  test("readOnly fails for a creating entry the lock does not mark", async ({ page }) => {
    const harness = sabotaged(() => {
      const unmark = () => {
        for (const entry of document.querySelectorAll('[data-action="create.box"][aria-disabled]')) {
          entry.removeAttribute("aria-disabled");
        }
      };
      new MutationObserver(unmark).observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["aria-disabled"],
      });
    });
    await expect(runCase("readOnly", page, harness)).rejects.toThrow(
      /palette: "create\.box" is not aria-disabled on the read-only canvas/,
    );
  });

  test("readOnly fails for view toggles and export disabled on the read-only canvas", async ({ page }) => {
    const harness = sabotaged(() => {
      const disable = () => {
        if (!document.querySelector(".cd-shell[data-readonly]")) return;
        for (const item of document.querySelectorAll(
          '[data-menu-id="legend"], [data-menu-id="export-png"]',
        )) {
          if (item.getAttribute("aria-disabled") !== "true") item.setAttribute("aria-disabled", "true");
        }
      };
      new MutationObserver(disable).observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
      });
    });
    const failure = await runCase("readOnly", page, harness).then(
      () => "passed",
      (error: unknown) => String(error),
    );
    expect(failure).toMatch(/menu: the Legend toggle is aria-disabled on the read-only canvas/);
    expect(failure).toMatch(/menu: "Export as PNG" is aria-disabled on the read-only canvas/);
  });

  test("geometry and aria fail for an island the harness declares absent", async ({ page }) => {
    const base = demoHarness("ide");
    const harness: ShellConformanceHarness<Page> = {
      ...base,
      sizes: WIDE_ONLY,
      show: { ...base.show, legend: undefined },
      absent: ["legend"],
    };
    await expect(runCase("geometry", page, harness)).rejects.toThrow(
      /\[1280 × 900, as opened\] legend: visible, but harness\.absent says the modeler has no legend/,
    );
    await expect(runCase("aria", page, harness)).rejects.toThrow(
      /legend: visible, but harness\.absent says the modeler has no legend/,
    );
  });

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

  test("aria fails for a palette shortcut that only the tooltip chip names", async ({ page }) => {
    const harness = sabotaged(() => {
      for (const entry of document.querySelectorAll('[data-chrome="palette"] [aria-keyshortcuts]')) {
        entry.removeAttribute("aria-keyshortcuts");
      }
    });
    await expect(runCase("aria", page, harness)).rejects.toThrow(
      /palette: entry "lasso-tool" shows the shortcut "L" in its tooltip but has no aria-keyshortcuts/,
    );
  });

  test("aria fails for an extra tab stop a renderer puts on .djs-container", async ({ page }) => {
    // Event Storming's keyboard sets tabindex="0" on canvas.getContainer()
    const harness = sabotaged(() => {
      document.querySelector(".djs-container")?.setAttribute("tabindex", "0");
    });
    await expect(runCase("aria", page, harness)).rejects.toThrow(
      /tab order: Tab from the menu trigger lands on div\.djs-container.*\[tabindex="0"\], expected the palette's roving entry/,
    );
  });

  test("aria fails when the open menu lets its arrow keys reach document listeners", async ({ page }) => {
    const harness = sabotaged(() => {
      const ignore = () => {};
      Event.prototype.stopPropagation = ignore;
      Event.prototype.stopImmediatePropagation = ignore;
    });
    await expect(runCase("aria", page, harness)).rejects.toThrow(
      /menu: ArrowUp in the open menu reached a keydown listener on document/,
    );
  });

  test("aria fails for a canvas without an accessible name", async ({ page }) => {
    const harness = sabotaged(() => {
      document.querySelector(".djs-container > svg")?.removeAttribute("aria-label");
    });
    await expect(runCase("aria", page, harness)).rejects.toThrow(
      /canvas: the focusable <svg> has no accessible name/,
    );
  });

  test("keys fails when the canvas takes Cmd/Ctrl+Z from VS Code's document history", async ({ page }) => {
    const harness = sabotaged(() => {
      document.addEventListener("keydown", (event) => {
        const onCanvas = (event.target as Element | null)?.closest?.(".djs-container") !== null;
        if (onCanvas && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
          event.preventDefault();
        }
      });
    });
    await expect(runCase("keys", page, harness)).rejects.toThrow(
      /Control\+KeyZ on the canvas \(undo and redo belong to the VS Code document\) arrived prevented/,
    );
  });

  test("appearance fails for an embedded root that takes the host page's mode", async ({ page }) => {
    const harness = sabotaged(() => {
      document.querySelector(".cd-shell")?.removeAttribute("data-cd-theme");
    }, "embedded");
    await expect(runCase("appearance", page, harness)).rejects.toThrow(
      /\[requested dark\] the embedded root has no data-cd-theme \(host page dark, expected light\)/,
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
