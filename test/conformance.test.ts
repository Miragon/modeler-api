/**
 * The kit's own CI: the conforming reference modeler passes EVERY case, and
 * each deliberately broken variant — one per real-world drift the contract
 * bans, and one per case in the kit — fails exactly the case set that
 * encodes the violated law. This is what makes the kit trustworthy: a law
 * whose case a saboteur passes is a law the kit does not actually enforce.
 */
import { describe, expect, test } from "vitest";

import pkg from "../package.json" with { type: "json" };
import {
  apiVersionsCompatible,
  type ConformanceHarness,
  conformanceCases,
  registerConformance,
} from "../src/conformance.js";
import { MODELER_API_VERSION } from "../src/index.js";
import { createReferenceModeler, type Flaws, type ReferenceModeler } from "./reference-modeler.js";

function harness(flaws: Flaws = {}, overrides: Partial<ConformanceHarness> = {}): ConformanceHarness {
  let counter = 0;
  return {
    create: async () => createReferenceModeler(flaws),
    createReadonly: async () => createReferenceModeler(flaws, false),
    canonicalTexts: ["alpha\nbeta\ngamma\n", "delta\n", "title: Tea\nalpha\n"],
    looseTexts: ["  beta \n\nalpha\ngamma\n\n"],
    invalidTexts: ["!boom\nalpha\n"],
    foreignTexts: [{ text: "% vendor: keep-me\nalpha\n", mustSurvive: ["% vendor: keep-me"] }],
    viewState: { zoom: 2, scrollX: 40 },
    mutate: (m) => (m as ReferenceModeler).addLine(`zz-${counter++}`),
    configMutations: [{ name: "title", run: (m) => (m as ReferenceModeler).setTitle(`T${counter++}`) }],
    undo: (m) => (m as ReferenceModeler).undoCommand(),
    redo: (m) => (m as ReferenceModeler).redoCommand(),
    ...overrides,
  };
}

const CASE = {
  meta: "meta declares the notation, editability and a compatible apiVersion",
  l1Fresh: "L1: importText is silent (no change events, for canonical, loose and foreign inputs)",
  l1History: "L1: importText over EXISTING undo history is silent too",
  l2Fixpoint: "L2: canonical texts are byte fixpoints of import → export",
  l2Idempotent: "L2: canonicalization of loose input is idempotent",
  l3Mutation:
    "L3: a scripted user mutation fires onContentChanged, and the export already reflects it inside the listener",
  l3Config: "L3: config/axis edits fire onContentChanged too, with the export already updated",
  l3Unsubscribe: "L3: unsubscribe stops delivery",
  l3Undo: "L3: undo and redo fire onContentChanged and restore the export",
  l4: "L4: undo directly after an import is a no-op",
  l5Fresh: "L5: getViewState never throws before the first import",
  l5RoundTrip:
    "L5: view state round-trips across a re-import, an import fits the view — and none of it is document content",
  elements:
    "elements (when present): stable ids across re-imports and unrelated edits, reveal and selection semantics",
  l6Total: "L6: export is total after imports, user mutations and undo",
  l6Foreign: "L6: foreign content survives an import → export round-trip",
  l7NoTrace: "L7: a rejected import leaves no trace",
  l7Usable: "L7: the modeler stays usable after a rejected import",
  viewer: "viewer (when shipped): read-only, silent, canonical, reveals, and unshaken by a rejected import",
  destroy: "destroy is safe to call twice",
};

/** run every case against a harness; the names of the failing ones */
async function failingCases(h: ConformanceHarness): Promise<string[]> {
  const results = await Promise.all(
    conformanceCases().map(async (c) => ({
      name: c.name,
      failed: await c.run(h).then(
        () => false,
        () => true,
      ),
    })),
  );
  return results.filter((r) => r.failed).map((r) => r.name);
}

describe("the conforming reference modeler", () => {
  registerConformance(harness(), test, {
    onSkip: (name, reason) => {
      throw new Error(`the full harness must skip nothing — "${name}" skipped: ${reason}`);
    },
  });

  test("every case name the saboteur table pins exists in the kit", () => {
    const names = new Set(conformanceCases().map((c) => c.name));
    for (const name of Object.values(CASE)) expect(names.has(name), name).toBe(true);
    expect(names.size).toBe(Object.keys(CASE).length);
  });

  test("the conforming reference fails NOTHING", async () => {
    expect(await failingCases(harness())).toEqual([]);
  });

  test("a diagram-js style enriched view-state readback (scale/inner/outer, rounded) is NOT a violation", async () => {
    expect(await failingCases(harness({ enrichedViewStateReadback: true }))).toEqual([]);
  });

  test("optional harness fields left undefined are reported as SKIPPED, never a silent green", async () => {
    const skipped: string[] = [];
    const ran: string[] = [];
    const sparse = harness(
      {},
      {
        createReadonly: undefined,
        looseTexts: undefined,
        invalidTexts: undefined,
        foreignTexts: undefined,
        viewState: undefined,
        configMutations: undefined,
        undo: undefined,
        redo: undefined,
      },
    );
    const pending: unknown[] = [];
    registerConformance(
      sparse,
      (name, fn) => {
        ran.push(name);
        pending.push(fn());
      },
      { onSkip: (name) => skipped.push(name) },
    );
    await Promise.all(pending);
    expect(ran.length).toBe(conformanceCases().length);
    expect(skipped.sort()).toEqual(
      [
        CASE.l2Idempotent,
        CASE.l3Config,
        CASE.l3Undo,
        CASE.l4,
        CASE.l5RoundTrip,
        CASE.l6Foreign,
        CASE.l7NoTrace,
        CASE.l7Usable,
        CASE.viewer,
      ].sort(),
    );
    // an EXPLICIT empty array is a statement, not an omission — no skip
    const explicit = harness({}, { looseTexts: [], invalidTexts: [], foreignTexts: [], configMutations: [] });
    const skippedExplicit: string[] = [];
    const pendingExplicit: unknown[] = [];
    registerConformance(explicit, (_n, fn) => pendingExplicit.push(fn()), {
      onSkip: (name) => skippedExplicit.push(name),
    });
    await Promise.all(pendingExplicit);
    expect(skippedExplicit).toEqual([]);
  });
});

describe("broken variants fail exactly their law's case set", () => {
  /** assert the EXACT failure set — a saboteur failing a different case than
   *  its law's would otherwise slip through a mere containment check */
  const expectFailures = async (flaws: Flaws, caseNames: string[]) => {
    expect((await failingCases(harness(flaws))).sort()).toEqual([...caseNames].sort());
  };

  // ── the historical drifts ──────────────────────────────────────────────────
  test("import echo (the wardley importDSL drift) → L1 twice, the echo inside L7's rejected import, the viewer", () =>
    expectFailures({ echoImport: true }, [CASE.l1Fresh, CASE.l1History, CASE.l7NoTrace, CASE.viewer]));
  test("import echo only over existing history → exactly the L1 history case", () =>
    expectFailures({ echoOnHistoryOnly: true }, [CASE.l1History]));
  test("import echo only on foreign content → exactly the L1 fresh case", () =>
    expectFailures({ echoOnForeignOnly: true }, [CASE.l1Fresh]));
  test("non-fixpoint serializer (grows the file per round-trip) → both L2 cases, L6 foreign, L7 usable, the viewer", () =>
    expectFailures({ nonCanonicalExport: true }, [
      CASE.l2Fixpoint,
      CASE.l2Idempotent,
      CASE.l6Foreign,
      CASE.l7Usable,
      CASE.viewer,
    ]));
  test("stale undo across imports (the tt drift) → exactly L4", () =>
    expectFailures({ staleUndo: true }, [CASE.l4]));
  test("leaky unsubscribe → exactly the unsubscribe case", () =>
    expectFailures({ leakyUnsubscribe: true }, [CASE.l3Unsubscribe]));

  // ── one saboteur per kit case ──────────────────────────────────────────────
  test("dropping foreign content (a stripping schema) → exactly L6 foreign", () =>
    expectFailures({ dropForeign: true }, [CASE.l6Foreign]));
  test("blank + wedged after a rejected import → both L7 cases and the viewer", () =>
    expectFailures({ wedgeAfterReject: true }, [CASE.l7NoTrace, CASE.l7Usable, CASE.viewer]));
  test("silent undo → exactly the L3 undo/redo case", () =>
    expectFailures({ silentUndo: true }, [CASE.l3Undo]));
  test("silent redo → exactly the L3 undo/redo case", () =>
    expectFailures({ silentRedo: true }, [CASE.l3Undo]));
  test("no-op setViewState → L5 round-trip and the viewer", () =>
    expectFailures({ noopViewState: true }, [CASE.l5RoundTrip, CASE.viewer]));
  test("an import that keeps the viewport instead of fitting → exactly L5 round-trip", () =>
    expectFailures({ noFitOnImport: true }, [CASE.l5RoundTrip]));
  test("dead selection surface → exactly the elements case", () =>
    expectFailures({ deadSelection: true }, [CASE.elements]));
  test("leaky selection unsubscribe → exactly the elements case", () =>
    expectFailures({ leakySelectionUnsubscribe: true }, [CASE.elements]));
  test("config edit outside the command stack that never emits → exactly the L3 config case", () =>
    expectFailures({ configEditSilent: true }, [CASE.l3Config]));
  test("emit before apply → exactly the L3 mutation case", () =>
    expectFailures({ emitBeforeApply: true }, [CASE.l3Mutation]));
  test("silent element command → the L3 mutation case and L7 usable (looks wedged)", () =>
    expectFailures({ silentMutation: true }, [CASE.l3Mutation, CASE.l7Usable]));
  test("setViewState emits → L5 round-trip and the viewer", () =>
    expectFailures({ viewStateEmits: true }, [CASE.l5RoundTrip, CASE.viewer]));
  test("invalid input resolves instead of rejecting → both L7 cases and the viewer", () =>
    expectFailures({ rejectResolves: true }, [CASE.l7NoTrace, CASE.l7Usable, CASE.viewer]));
  test("rejected import clears the document → L7 no-trace and the viewer", () =>
    expectFailures({ rejectMutatesDoc: true }, [CASE.l7NoTrace, CASE.viewer]));
  test("reveal(unknown id) returns true → the elements case and the viewer", () =>
    expectFailures({ revealUnknownTrue: true }, [CASE.elements, CASE.viewer]));
  test("exportText throws after a command → every case that exports after a mutation", () =>
    expectFailures({ exportThrowsAfterMutate: true }, [
      CASE.l3Mutation,
      CASE.l3Undo,
      CASE.l4,
      CASE.l6Total,
      CASE.l7Usable,
    ]));
  test("positional element ids (renumbered on every edit) → exactly the elements case", () =>
    expectFailures({ positionalIds: true }, [CASE.elements]));
  test("a viewer that emits on import → exactly the viewer case", () =>
    expectFailures({ viewerEmits: true }, [CASE.viewer]));
  test("a viewer whose importText throws (no command stack) → exactly the viewer case", () =>
    expectFailures({ viewerImportThrows: true }, [CASE.viewer]));
  test("a viewer that cannot reveal (no selection service) → exactly the viewer case", () =>
    expectFailures({ viewerCannotReveal: true }, [CASE.viewer]));

  test("the contract version constant IS the package version (one identity)", () => {
    expect(MODELER_API_VERSION).toBe(pkg.version);
  });

  test("apiVersion compatibility: same major; while 0.x, the same minor too", () => {
    expect(apiVersionsCompatible("0.3.1", "0.3.9")).toBe(true);
    expect(apiVersionsCompatible("0.3.1", "0.4.0")).toBe(false);
    expect(apiVersionsCompatible("1.2.0", "1.9.3")).toBe(true);
    expect(apiVersionsCompatible("1.2.0", "2.0.0")).toBe(false);
  });
});
