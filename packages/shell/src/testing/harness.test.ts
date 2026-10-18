import { afterEach, describe, expect, it, vi } from "vitest";

import {
  registerShellConformance,
  shellConformanceCases,
  type OpenContext,
  type ShellConformanceHarness,
} from "./harness.js";
import type { PageLike } from "./page.js";

/** A page whose shell root never appears: every probe finds nothing. */
function emptyPage(): PageLike {
  return {
    evaluate: async <R>() => null as R,
    setViewportSize: async () => {},
    keyboard: { press: async () => {} },
    mouse: { click: async () => {}, move: async () => {} },
    waitForTimeout: async () => {},
  };
}

function harness(overrides: Partial<ShellConformanceHarness> = {}): ShellConformanceHarness {
  return { host: "ide", themes: ["light"], open: async () => {}, ...overrides };
}

type Body = (fixtures: { page: PageLike }) => Promise<void>;

function register(subject: ShellConformanceHarness, onSkip?: (name: string, reason: string) => void) {
  const tests = new Map<string, Body>();
  registerShellConformance(subject, (name, body) => tests.set(name, body), onSkip ? { onSkip } : undefined);
  return tests;
}

describe("shellConformanceCases", () => {
  it("are geometry, aria, keys, appearance and cleanup", () => {
    expect(shellConformanceCases().map((conformanceCase) => conformanceCase.name)).toEqual([
      "geometry",
      "aria",
      "keys",
      "appearance",
      "cleanup",
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
      "shell conformance: aria",
      "shell conformance: keys",
      "shell conformance: appearance",
      "shell conformance: cleanup",
    ]);
  });

  it("reports a case the harness cannot feed through onSkip", async () => {
    const onSkip = vi.fn();
    const open = vi.fn(async () => {});
    await register(harness({ open }), onSkip).get("shell conformance: cleanup")!({ page: emptyPage() });
    expect(onSkip).toHaveBeenCalledWith(
      "cleanup",
      "harness.destroy is undefined: the cleanup after destroy was not verified",
    );
    expect(open).not.toHaveBeenCalled();
  });

  it("warns on the console by default", async () => {
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
