/**
 * The kit's own CI: the conforming reference modeler passes EVERY case, and
 * each deliberately broken variant — one per real-world drift the contract
 * bans — fails exactly the case that encodes the violated law. This is what
 * makes the kit trustworthy: a law whose case a saboteur passes is a law the
 * kit does not actually enforce.
 */
import { describe, expect, test } from "vitest";

import pkg from "../package.json" with { type: "json" };
import { type ConformanceHarness, conformanceCases, registerConformance } from "../src/conformance.js";
import { MODELER_API_VERSION } from "../src/index.js";
import { createReferenceModeler } from "./reference-modeler.js";

type ReferenceModeler = ReturnType<typeof createReferenceModeler>;

function harness(flaws: Parameters<typeof createReferenceModeler>[0] = {}): ConformanceHarness {
  let counter = 0;
  return {
    create: async () => createReferenceModeler(flaws),
    canonicalTexts: ["alpha\nbeta\ngamma\n", "delta\n"],
    looseTexts: ["  beta \n\nalpha\ngamma\n\n"],
    invalidTexts: ["!boom\nalpha\n"],
    foreignTexts: ["% vendor: keep-me\nalpha\n"],
    mutate: (m) => (m as ReferenceModeler & { addLine(t: string): void }).addLine(`zz-${counter++}`),
    undo: (m) => (m as ReferenceModeler & { undoCommand(): void }).undoCommand(),
  };
}

describe("the conforming reference modeler", () => {
  registerConformance(harness(), test);
});

describe("broken variants fail exactly their law's case", () => {
  /** assert the EXACT failure set — a saboteur failing a different case than
   *  its law's would otherwise slip through a mere containment check */
  const expectFailures = async (flaws: Parameters<typeof createReferenceModeler>[0], caseNames: string[]) => {
    const results = await Promise.all(
      conformanceCases().map(async (c) => ({
        name: c.name,
        failed: await c.run(harness(flaws)).then(
          () => false,
          () => true,
        ),
      })),
    );
    const failedNames = results.filter((r) => r.failed).map((r) => r.name);
    expect(failedNames.sort()).toEqual([...caseNames].sort());
  };

  test("import echo (the wardley importDSL drift) → fails L1 (and its echo inside L7's rejected import)", async () => {
    await expectFailures({ echoImport: true }, [
      "L1: importText is silent (no change events, for canonical and loose inputs)",
      "L7: a rejected import leaves no trace",
    ]);
  });

  test("non-fixpoint serializer (grows the file per round-trip) → fails both L2 cases and L6", async () => {
    await expectFailures({ nonCanonicalExport: true }, [
      "L2: canonical texts are byte fixpoints of import → export",
      "L2: canonicalization of loose input is idempotent",
      "L6: export is total and foreign content survives round-trips",
    ]);
  });

  test("stale undo across imports (the tt drift) → fails exactly L4", async () => {
    await expectFailures({ staleUndo: true }, ["L4: undo directly after an import is a no-op"]);
  });

  test("leaky unsubscribe → fails exactly the unsubscribe case", async () => {
    await expectFailures({ leakyUnsubscribe: true }, ["L3: unsubscribe stops delivery"]);
  });

  test("the contract version constant follows the package version (one identity)", () => {
    expect(MODELER_API_VERSION.split(".")[0]).toBe(pkg.version.split(".")[0]);
  });

  test("the conforming reference fails NOTHING", async () => {
    const results = await Promise.all(
      conformanceCases().map(async (c) => ({
        name: c.name,
        failed: await c.run(harness()).then(
          () => false,
          () => true,
        ),
      })),
    );
    expect(results.filter((r) => r.failed)).toEqual([]);
  });
});
