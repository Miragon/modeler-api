import { afterEach, describe, expect, it, vi } from "vitest";

import {
  registerShellConformance,
  shellConformanceCases,
  type OpenContext,
  type ShellConformanceHarness,
  type ShellSkip,
} from "./harness.js";
import type { PageLike } from "./page.js";

/** A page whose shell root never appears: every probe finds nothing. */
function emptyPage(): PageLike {
  return {
    evaluate: async <R>() => null as R,
    setViewportSize: async () => {},
    keyboard: { press: async () => {} },
    mouse: {
      click: async () => {},
      dblclick: async () => {},
      move: async () => {},
      down: async () => {},
      up: async () => {},
    },
    waitForTimeout: async () => {},
  };
}

function harness(overrides: Partial<ShellConformanceHarness> = {}): ShellConformanceHarness {
  return { host: "ide", themes: ["light"], open: async () => {}, ...overrides };
}

type Body = (fixtures: { page: PageLike }) => Promise<void>;

function register(
  subject: ShellConformanceHarness,
  onSkip?: (name: string, skips: readonly ShellSkip[]) => void,
) {
  const tests = new Map<string, Body>();
  registerShellConformance(subject, (name, body) => tests.set(name, body), onSkip ? { onSkip } : undefined);
  return tests;
}

describe("shellConformanceCases", () => {
  it("are the cases of every host, then the web column's after cleanup", () => {
    expect(shellConformanceCases().map((conformanceCase) => conformanceCase.name)).toEqual([
      "geometry",
      "legendStart",
      "aria",
      "keys",
      "focusHandBack",
      "create",
      "labelEditor",
      "readOnly",
      "appearance",
      "cleanup",
      "webChrome",
      "emptyState",
      "toasts",
      "problemsList",
      "dropZone",
    ]);
  });

  it("are a fresh list on every call", () => {
    expect(shellConformanceCases()).not.toBe(shellConformanceCases());
  });
});

describe("registerShellConformance", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers every case as `shell conformance: <name>`", () => {
    expect([...register(harness()).keys()]).toEqual([
      "shell conformance: geometry",
      "shell conformance: legendStart",
      "shell conformance: aria",
      "shell conformance: keys",
      "shell conformance: focusHandBack",
      "shell conformance: create",
      "shell conformance: labelEditor",
      "shell conformance: readOnly",
      "shell conformance: appearance",
      "shell conformance: cleanup",
      "shell conformance: webChrome",
      "shell conformance: emptyState",
      "shell conformance: toasts",
      "shell conformance: problemsList",
      "shell conformance: dropZone",
    ]);
  });

  it("reports what the harness cannot feed through onSkip, one entry per missing field", async () => {
    const onSkip = vi.fn();
    const open = vi.fn(async () => {});
    const tests = register(harness({ open }), onSkip);
    await tests.get("shell conformance: cleanup")!({ page: emptyPage() });
    await tests.get("shell conformance: readOnly")!({ page: emptyPage() });
    expect(onSkip.mock.calls).toEqual([
      [
        "cleanup",
        [
          {
            hook: "destroy",
            reason: "harness.destroy is undefined: the cleanup after destroy was not verified",
          },
        ],
      ],
      [
        "readOnly",
        [
          {
            hook: "invalid",
            reason: "show.invalid is undefined: the read-only canvas of an invalid file was not verified",
          },
        ],
      ],
    ]);
    expect(open).not.toHaveBeenCalled();
  });

  it("skips the label editor case without harness.labelEditor, before opening anything", async () => {
    const onSkip = vi.fn();
    const open = vi.fn(async () => {});
    await register(harness({ open }), onSkip).get("shell conformance: labelEditor")!({ page: emptyPage() });
    expect(onSkip.mock.calls).toEqual([
      [
        "labelEditor",
        [
          {
            hook: "labelEditor",
            reason:
              "harness.labelEditor is undefined: that the shell's zoom, fit and refit never commit or close an open label editor was not verified",
          },
        ],
      ],
    ]);
    expect(open).not.toHaveBeenCalled();
  });

  it("does not report a label editor the harness declares absent, and fails one it also gives", async () => {
    const onSkip = vi.fn();
    const open = vi.fn(async () => {});
    await register(harness({ open, absent: ["labelEditor"] }), onSkip).get("shell conformance: labelEditor")!(
      {
        page: emptyPage(),
      },
    );
    expect(onSkip).not.toHaveBeenCalled();
    const labelEditor = { open: async () => "Renamed", documentChanged: async () => false };
    await expect(
      register(harness({ open, labelEditor, absent: ["labelEditor"] })).get(
        "shell conformance: labelEditor",
      )!({
        page: emptyPage(),
      }),
    ).rejects.toThrow(
      '@miragon/modeler-shell conformance: labelEditor (ide host)\n- harness: absent lists "labelEditor", but harness.labelEditor is given',
    );
    expect(open).not.toHaveBeenCalled();
  });

  it("opens the harness for the label editor case and needs the shell root before the editor", async () => {
    const open = vi.fn(async () => {});
    const labelEditor = { open: vi.fn(async () => "Renamed"), documentChanged: async () => false };
    await expect(
      register(harness({ open, labelEditor })).get("shell conformance: labelEditor")!({ page: emptyPage() }),
    ).rejects.toThrow(
      '@miragon/modeler-shell conformance: labelEditor (ide host)\n- no element matches the shell root selector ".cd-shell"',
    );
    expect(open).toHaveBeenCalledWith(expect.anything(), {
      size: { width: 1280, height: 900 },
      requested: { theme: "light" },
    });
    expect(labelEditor.open).not.toHaveBeenCalled();
  });

  it("does not report a hook the harness declares absent", async () => {
    const onSkip = vi.fn();
    const open = vi.fn(async () => {});
    await register(harness({ open, absent: ["invalid"] }), onSkip).get("shell conformance: readOnly")!({
      page: emptyPage(),
    });
    expect(onSkip).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("fails a harness that gives a hook it declares absent, before opening anything", async () => {
    const open = vi.fn(async () => {});
    const legend = async () => {};
    const tests = register(
      harness({ open, absent: ["legend", "invalid"], show: { legend, invalid: legend } }),
    );
    for (const name of ["geometry", "legendStart", "aria"]) {
      await expect(tests.get(`shell conformance: ${name}`)!({ page: emptyPage() })).rejects.toThrow(
        `@miragon/modeler-shell conformance: ${name} (ide host)\n- harness: absent lists "legend", but show.legend is given`,
      );
    }
    await expect(tests.get("shell conformance: readOnly")!({ page: emptyPage() })).rejects.toThrow(
      'harness: absent lists "invalid", but show.invalid is given',
    );
    expect(open).not.toHaveBeenCalled();
  });

  it("warns on the console by default, the skips of a case on one line", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await register(harness()).get("shell conformance: cleanup")!({ page: emptyPage() });
    expect(warn).toHaveBeenCalledWith(
      '@miragon/modeler-shell conformance: SKIPPED "cleanup" (ide host): harness.destroy is undefined: the cleanup after destroy was not verified',
    );
  });

  it("fails with a plain Error naming case, host and problem", async () => {
    const tests = register(harness({ host: "web" }));
    const failure = tests.get("shell conformance: aria")!({ page: emptyPage() });
    await expect(failure).rejects.toThrow(Error);
    await expect(tests.get("shell conformance: aria")!({ page: emptyPage() })).rejects.toThrow(
      '@miragon/modeler-shell conformance: aria (web host)\n- no element matches the shell root selector ".cd-shell"',
    );
  });

  it("opens the harness at the requested size with a light request, as the host would", async () => {
    const open = vi.fn(async () => {});
    const tests = register(harness({ open, root: "#modeler", sizes: [{ width: 800, height: 600 }] }));
    await expect(tests.get("shell conformance: keys")!({ page: emptyPage() })).rejects.toThrow(
      /keys \(ide host\)\n- canvas: the diagram-js <svg>/,
    );
    expect(open).toHaveBeenCalledWith(expect.anything(), {
      size: { width: 800, height: 600 },
      requested: { theme: "light" },
    });
  });

  it("skips the legend's start state without show.legend and checks nothing for an absent legend", async () => {
    const onSkip = vi.fn();
    const open = vi.fn(async () => {});
    await register(harness({ open }), onSkip).get("shell conformance: legendStart")!({ page: emptyPage() });
    await register(harness({ open, absent: ["legend"] }), onSkip).get("shell conformance: legendStart")!({
      page: emptyPage(),
    });
    expect(onSkip.mock.calls).toEqual([
      [
        "legendStart",
        [{ hook: "legend", reason: "show.legend is undefined: the legend's start state was not verified" }],
      ],
    ]);
    expect(open).not.toHaveBeenCalled();
  });

  it("opens the legend's start state at 390 × 844 with a light request, whatever the harness sizes", async () => {
    const open = vi.fn(async (_page: PageLike, _context: OpenContext) => {});
    const legend = async () => {};
    const tests = register(harness({ open, show: { legend }, sizes: [{ width: 800, height: 600 }] }));
    await expect(tests.get("shell conformance: legendStart")!({ page: emptyPage() })).rejects.toThrow();
    expect(open.mock.calls.map(([, context]) => context)).toEqual([
      { size: { width: 390, height: 844 }, requested: { theme: "light" } },
    ]);
  });

  it("fails a harness whose open keeps the page's document, before it measures the legend", async () => {
    // an open that only changes the URL fragment: the page, and the kit's tools in it, stay
    const keptPage: PageLike = {
      ...emptyPage(),
      evaluate: async <R, Arg>(pageFunction: (arg: Arg) => R | Promise<R>, arg: Arg) => pageFunction(arg),
    };
    const open = vi.fn(async () => {});
    const legend = async () => {};
    try {
      const tests = register(harness({ host: "web", open, show: { legend } }));
      await expect(tests.get("shell conformance: legendStart")!({ page: keptPage })).rejects.toThrow(
        "@miragon/modeler-shell conformance: legendStart (web host)\n- harness: open kept the page's document at 390 × 844",
      );
      expect(open).toHaveBeenCalledTimes(1);
    } finally {
      delete (window as { __modelerShellConformance?: unknown }).__modelerShellConformance;
    }
  });

  it("skips the web column's cases the web harness cannot feed, before opening anything", async () => {
    const onSkip = vi.fn();
    const open = vi.fn(async () => {});
    const tests = register(harness({ host: "web", open }), onSkip);
    for (const name of ["emptyState", "toasts", "problemsList", "dropZone"]) {
      await tests.get(`shell conformance: ${name}`)!({ page: emptyPage() });
    }
    expect(onSkip.mock.calls).toEqual([
      [
        "emptyState",
        [{ hook: "emptyState", reason: "show.emptyState is undefined: the start screen not verified" }],
      ],
      ["toasts", [{ hook: "toast", reason: "show.toast is undefined: the toasts not verified" }]],
      [
        "problemsList",
        [{ hook: "problems", reason: "show.problems is undefined: the problems list not verified" }],
      ],
      ["dropZone", [{ hook: "drop", reason: "harness.drop is undefined: the drop zone not verified" }]],
    ]);
    expect(open).not.toHaveBeenCalled();
  });

  it("does not report the web column's features the harness declares absent", async () => {
    const onSkip = vi.fn();
    const open = vi.fn(async () => {});
    const tests = register(
      harness({ host: "web", open, absent: ["emptyState", "toast", "problems", "drop"] }),
      onSkip,
    );
    for (const name of ["emptyState", "toasts", "problemsList", "dropZone"]) {
      await tests.get(`shell conformance: ${name}`)!({ page: emptyPage() });
    }
    expect(onSkip).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("needs no web hooks in the IDE host, where nothing of the web column shows", async () => {
    const onSkip = vi.fn();
    const tests = register(harness({ absent: ["problems"] }), onSkip);
    for (const name of ["emptyState", "toasts", "problemsList", "dropZone"]) {
      await tests.get(`shell conformance: ${name}`)!({ page: emptyPage() });
    }
    expect(onSkip).not.toHaveBeenCalled();
  });

  it("fails a harness that gives a web feature it declares absent", async () => {
    const open = vi.fn(async () => {});
    const toast = async () => {};
    const tests = register(
      harness({
        host: "web",
        open,
        show: { toast },
        drop: { accepted: { name: "a.json", type: "application/json", text: "{}" } },
        absent: ["toast", "drop"],
      }),
    );
    await expect(tests.get("shell conformance: toasts")!({ page: emptyPage() })).rejects.toThrow(
      'harness: absent lists "toast", but show.toast is given',
    );
    await expect(tests.get("shell conformance: dropZone")!({ page: emptyPage() })).rejects.toThrow(
      'harness: absent lists "drop", but harness.drop is given',
    );
    expect(open).not.toHaveBeenCalled();
  });

  it("emulates the system's mode and contrast before opening the web host", async () => {
    const calls: string[] = [];
    const page: PageLike = {
      ...emptyPage(),
      emulateMedia: async (options) => {
        calls.push(`emulate ${options.colorScheme ?? ""} ${options.contrast ?? ""}`);
      },
    };
    const open = vi.fn(async (_page: PageLike, context: OpenContext) => {
      calls.push(
        `open ${context.requested.theme}${context.requested.kontrast ? ` ${context.requested.kontrast}` : ""}`,
      );
    });
    await expect(
      register(harness({ host: "web", open })).get("shell conformance: appearance")!({ page }),
    ).rejects.toThrow(/appearance \(web host\)/);
    expect(calls).toEqual([
      "emulate dark no-preference",
      "open dark",
      "emulate dark more",
      "open dark hoch",
      "emulate light more",
      "open light hoch",
    ]);
  });

  it("opens the web host once with light when the page cannot emulate media", async () => {
    const open = vi.fn(async (_page: PageLike, _context: OpenContext) => {});
    await expect(
      register(harness({ host: "web", open })).get("shell conformance: appearance")!({ page: emptyPage() }),
    ).rejects.toThrow(/appearance \(web host\)/);
    expect(open.mock.calls.map(([, context]) => context.requested)).toEqual([{ theme: "light" }]);
  });

  it("requests dark, dark with high contrast and light with high contrast in the appearance case", async () => {
    const open = vi.fn(async (_page: PageLike, _context: OpenContext) => {});
    await expect(
      register(harness({ open })).get("shell conformance: appearance")!({ page: emptyPage() }),
    ).rejects.toThrow(/appearance \(ide host\)/);
    expect(open.mock.calls.map(([, context]) => context.requested)).toEqual([
      { theme: "dark" },
      { theme: "dark", kontrast: "hoch" },
      { theme: "light", kontrast: "hoch" },
    ]);
  });
});
