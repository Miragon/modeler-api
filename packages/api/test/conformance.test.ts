/**
 * The kit's own CI: the conforming reference modeler passes EVERY case, and
 * each deliberately broken variant — one per real-world drift the contract
 * bans, and one per case in the kit — fails exactly the case set that
 * encodes the violated law. This is what makes the kit trustworthy: a law
 * whose case a saboteur passes is a law the kit does not actually enforce.
 * A variant that only misses a RECOMMENDATION fails nothing and advises
 * exactly once — a recommendation must never turn a modeler red.
 */
import { describe, expect, test, vi } from "vitest";

import pkg from "../package.json" with { type: "json" };
import {
  apiVersionsCompatible,
  type CaseOutcome,
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
    // a rejecting probe, so the conforming reference walks the rejection path too
    probeTexts: ["alpha\n!be"],
    openInteraction: (m) => {
      const elementId = m.elements?.list()[0]?.id;
      if (elementId === undefined) throw new Error("the harness needs an element to edit");
      (m as ReferenceModeler).editLabel(elementId, "typed, not committed");
    },
    interactionState: (m) => (m as ReferenceModeler).openLabelEditor(),
    ...overrides,
  };
}

const CASE = {
  meta: "meta declares the notation, editability and a compatible apiVersion",
  preImport: "calls before the first import never wedge the instance",
  l1Fresh: "L1: importText is silent (no change events, for canonical, loose and foreign inputs)",
  l1History: "L1: importText over EXISTING undo history is silent too",
  l1Interaction: "L1: an interaction open during importText never commits",
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
  elementsRoundTrip:
    "elements (when present): ids and names survive export → import, in this and in a fresh instance",
  elementsCollision:
    "elements (when present, recommended): ids created on two peers at the same time do not collide",
  l6Total: "L6: export is total after imports, user mutations and undo",
  l6Foreign: "L6: foreign content survives an import → export round-trip",
  l7NoTrace: "L7: a rejected import leaves no trace",
  l7Usable: "L7: the modeler stays usable after a rejected import",
  l7Probes: "L7: every rejection of a derived probe leaves no trace",
  viewer:
    "viewer (when shipped): read-only, silent, canonical, fits, reveals, keeps foreign content, unshaken by a rejected import",
  destroy: "destroy is safe to call twice",
};

/** run every case against a harness; per case whether it failed and what it resolved with */
async function runCases(
  h: ConformanceHarness,
): Promise<Array<{ name: string; failed: boolean; outcome: CaseOutcome | undefined }>> {
  return Promise.all(
    conformanceCases().map(async (c) => {
      try {
        return { name: c.name, failed: false, outcome: (await c.run(h)) ?? undefined };
      } catch {
        return { name: c.name, failed: true, outcome: undefined };
      }
    }),
  );
}

/** run every case against a harness; the names of the failing ones */
async function failingCases(h: ConformanceHarness): Promise<string[]> {
  return (await runCases(h)).filter((r) => r.failed).map((r) => r.name);
}

/** run every case against a harness; one [case name, advice] pair per advisory */
async function advisories(h: ConformanceHarness): Promise<Array<[string, string]>> {
  return (await runCases(h)).flatMap((r) =>
    (r.outcome?.advisories ?? []).map((advice): [string, string] => [r.name, advice]),
  );
}

/** register against a fake runner that runs every case now; the skipped names */
async function skippedCases(h: ConformanceHarness): Promise<{ ran: number; skipped: string[] }> {
  const skipped: string[] = [];
  const pending: Promise<void>[] = [];
  registerConformance(h, (_name, fn) => pending.push(fn()), { onSkip: (name) => skipped.push(name) });
  await Promise.all(pending);
  return { ran: pending.length, skipped: skipped.sort() };
}

describe("the conforming reference modeler", () => {
  registerConformance(harness(), test, {
    onSkip: (name, reason) => {
      throw new Error(`the full harness must skip nothing — "${name}" skipped: ${reason}`);
    },
    onAdvisory: (name, advice) => {
      throw new Error(`the conforming reference follows every recommendation — "${name}" advised: ${advice}`);
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

  test("the conforming reference advises nothing", async () => {
    expect(await advisories(harness())).toEqual([]);
  });

  test("ids the serializer writes back (a renamed element keeps its id) survive export → import", async () => {
    const m = createReferenceModeler();
    await m.importText("alpha\nbeta\n");
    m.editLabel("alpha", "omega");
    m.commitLabel();
    expect(m.exportText()).toBe("beta\nomega #alpha\n");
    const fresh = createReferenceModeler();
    await fresh.importText(m.exportText());
    expect(fresh.elements?.list()).toEqual([
      { id: "beta", name: "beta" },
      { id: "alpha", name: "omega" },
    ]);
  });

  test("optional harness fields left undefined are reported as SKIPPED, never a silent green", async () => {
    const sparse = await skippedCases(
      harness(
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
          probeTexts: undefined,
          openInteraction: undefined,
          interactionState: undefined,
        },
      ),
    );
    expect(sparse.ran).toBe(conformanceCases().length);
    expect(sparse.skipped).toEqual(
      [
        CASE.l1Interaction,
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
    // undo without redo: the undo half is verified, the redo half reports a skip
    expect((await skippedCases(harness({}, { redo: undefined }))).skipped).toEqual([CASE.l3Undo]);
    // an interaction without its state: the L1 half is verified, the keep-and-reopen half reports a skip
    expect((await skippedCases(harness({}, { interactionState: undefined }))).skipped).toEqual([
      CASE.l1Interaction,
    ]);
    // an EXPLICIT empty array is a statement, not an omission — no skip
    const explicit = await skippedCases(
      harness(
        {},
        { looseTexts: [], invalidTexts: [], foreignTexts: [], configMutations: [], probeTexts: [] },
      ),
    );
    expect(explicit.skipped).toEqual([]);
  });

  test("advisories reach onAdvisory once per advice, and console.warn by default", async () => {
    const run = async (options: Parameters<typeof registerConformance>[2]) => {
      const pending: Promise<void>[] = [];
      registerConformance(harness({ counterIds: true }), (_name, fn) => pending.push(fn()), options);
      await Promise.all(pending);
    };
    const routed: string[] = [];
    await run({ onAdvisory: (name) => routed.push(name) });
    expect(routed).toEqual([CASE.elementsCollision]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      await run({});
      expect(warn.mock.calls.map(([message]) => String(message))).toEqual([
        expect.stringContaining(`ADVISORY "${CASE.elementsCollision}"`),
      ]);
    } finally {
      warn.mockRestore();
    }
  });
});

describe("broken variants fail exactly their law's case set", () => {
  /** assert the EXACT failure set — a saboteur failing a different case than
   *  its law's would otherwise slip through a mere containment check */
  const expectFailures = async (
    flaws: Flaws,
    caseNames: string[],
    overrides: Partial<ConformanceHarness> = {},
  ) => {
    expect((await failingCases(harness(flaws, overrides))).sort()).toEqual([...caseNames].sort());
  };

  // ── the historical drifts ──────────────────────────────────────────────────
  test("import echo (the wardley importDSL drift) → every L1 case, the echo inside both L7 rejection cases, the viewer", () =>
    expectFailures({ echoImport: true }, [
      CASE.l1Fresh,
      CASE.l1History,
      CASE.l1Interaction,
      CASE.l7NoTrace,
      CASE.l7Probes,
      CASE.viewer,
    ]));
  test("import echo only over existing history → the L1 history case and both L7 rejection cases (they import over history)", () =>
    expectFailures({ echoOnHistoryOnly: true }, [CASE.l1History, CASE.l7NoTrace, CASE.l7Probes]));
  test("import echo only on foreign content → the L1 fresh case and the viewer's foreign import", () =>
    expectFailures({ echoOnForeignOnly: true }, [CASE.l1Fresh, CASE.viewer]));
  test("non-fixpoint serializer (grows the file per round-trip) → both L2 cases, L6 foreign, L7 usable, the viewer", () =>
    expectFailures({ nonCanonicalExport: true }, [
      CASE.l2Fixpoint,
      CASE.l2Idempotent,
      CASE.l6Foreign,
      CASE.l7Usable,
      CASE.viewer,
    ]));
  test("stale snapshot undo across imports (the tt drift) → exactly L4", () =>
    expectFailures({ staleUndo: true }, [CASE.l4]));
  test("stale DELTA undo across imports (the diagram-js form: revert removes by id) → exactly L4", () =>
    expectFailures({ staleUndoDelta: true }, [CASE.l4]));
  test("undo on an empty post-import stack that emits → exactly L4", () =>
    expectFailures({ undoOnEmptyEmits: true }, [CASE.l4]));
  test("leaky unsubscribe → exactly the unsubscribe case", () =>
    expectFailures({ leakyUnsubscribe: true }, [CASE.l3Unsubscribe]));

  // ── one saboteur per kit case ──────────────────────────────────────────────
  test("incompatible apiVersion → exactly the meta case", () =>
    expectFailures({ incompatibleApiVersion: true }, [CASE.meta]));
  test("dropping foreign content (a stripping schema) → L6 foreign and the viewer", () =>
    expectFailures({ dropForeign: true }, [CASE.l6Foreign, CASE.viewer]));
  test("blank + wedged after a rejected import → every L7 case and the viewer", () =>
    expectFailures({ wedgeAfterReject: true }, [CASE.l7NoTrace, CASE.l7Usable, CASE.l7Probes, CASE.viewer]));
  test("a rejected import that erases the undo history → L7 no-trace and the L7 probes (a rejecting probe)", () =>
    expectFailures({ rejectClearsUndo: true }, [CASE.l7NoTrace, CASE.l7Probes]));
  test("silent undo → exactly the L3 undo/redo case", () =>
    expectFailures({ silentUndo: true }, [CASE.l3Undo]));
  test("silent redo → exactly the L3 undo/redo case", () =>
    expectFailures({ silentRedo: true }, [CASE.l3Undo]));
  test("no-op setViewState → L5 round-trip and the viewer", () =>
    expectFailures({ noopViewState: true }, [CASE.l5RoundTrip, CASE.viewer]));
  test("an import that keeps the viewport instead of fitting → L5 round-trip and the viewer", () =>
    expectFailures({ noFitOnImport: true }, [CASE.l5RoundTrip, CASE.viewer]));
  test("a readback that setViewState does not accept → L5 round-trip and the viewer", () =>
    expectFailures({ readbackNotSettable: true }, [CASE.l5RoundTrip, CASE.viewer]));
  test("getViewState that throws before the first import → the L5 fresh case and the viewer", () =>
    expectFailures({ viewStateThrowsBeforeImport: true }, [CASE.l5Fresh, CASE.viewer]));
  test("dead selection surface → the elements case and the viewer", () =>
    expectFailures({ deadSelection: true }, [CASE.elements, CASE.viewer]));
  test("leaky selection unsubscribe → exactly the elements case", () =>
    expectFailures({ leakySelectionUnsubscribe: true }, [CASE.elements]));
  test("config edit outside the command stack that never emits → exactly the L3 config case", () =>
    expectFailures({ configEditSilent: true }, [CASE.l3Config]));
  test("emit before apply → exactly the L3 mutation case", () =>
    expectFailures({ emitBeforeApply: true }, [CASE.l3Mutation]));
  test("silent element command → the L3 mutation case, L7 usable and the pre-import case (looks wedged)", () =>
    expectFailures({ silentMutation: true }, [CASE.l3Mutation, CASE.l7Usable, CASE.preImport]));
  test("setViewState emits → L5 round-trip and the viewer", () =>
    expectFailures({ viewStateEmits: true }, [CASE.l5RoundTrip, CASE.viewer]));
  test("invalid input resolves instead of rejecting → both L7 cases and the viewer", () =>
    expectFailures({ rejectResolves: true }, [CASE.l7NoTrace, CASE.l7Usable, CASE.viewer]));
  test("rejected import clears the document → L7 no-trace, the L7 probes (a rejecting probe) and the viewer", () =>
    expectFailures({ rejectMutatesDoc: true }, [CASE.l7NoTrace, CASE.l7Probes, CASE.viewer]));
  test("reveal(unknown id) returns true → the elements case and the viewer", () =>
    expectFailures({ revealUnknownTrue: true }, [CASE.elements, CASE.viewer]));
  test("exportText throws after a command → every case that exports after a mutation", () =>
    expectFailures({ exportThrowsAfterMutate: true }, [
      CASE.preImport,
      CASE.l3Mutation,
      CASE.l3Undo,
      CASE.l4,
      CASE.elementsRoundTrip,
      CASE.l6Total,
      CASE.l7NoTrace,
      CASE.l7Usable,
      CASE.l7Probes,
    ]));
  test("positional element ids (renumbered on every edit) → exactly the elements case", () =>
    expectFailures({ positionalIds: true }, [CASE.elements]));
  test("a second destroy() that throws → the destroy case and the viewer", () =>
    expectFailures({ destroyThrowsTwice: true }, [CASE.destroy, CASE.viewer]));
  test("a viewer that emits on import → exactly the viewer case", () =>
    expectFailures({ viewerEmits: true }, [CASE.viewer]));
  test("a viewer whose importText throws (no command stack) → the viewer case and the viewer leg of the id round-trip", () =>
    expectFailures({ viewerImportThrows: true }, [CASE.viewer, CASE.elementsRoundTrip]));
  test("a viewer that cannot reveal (no selection service) → exactly the viewer case", () =>
    expectFailures({ viewerCannotReveal: true }, [CASE.viewer]));
  test("a viewer whose import keeps the viewport → exactly the viewer case", () =>
    expectFailures({ viewerKeepsView: true }, [CASE.viewer]));
  test("a viewer that drops foreign content → exactly the viewer case", () =>
    expectFailures({ viewerDropsForeign: true }, [CASE.viewer]));
  test("a viewer that selects without delivering onSelection → exactly the viewer case", () =>
    expectFailures({ viewerDeadSelectionEvents: true }, [CASE.viewer]));

  // ── the Event Storming pilot's findings ────────────────────────────────────
  test("in-memory ids the serializer never writes back → exactly the id round-trip case", () =>
    expectFailures({ idsChangeOnExport: true }, [CASE.elementsRoundTrip]));
  test("exportText() or a command before the first import wedges the parser → exactly the pre-import case", () =>
    expectFailures({ wedgeOnPreImportCall: true }, [CASE.preImport]));
  test("a truncated text rejects but blanks the document, with invalidTexts [] → exactly the L7 probe case", () =>
    expectFailures({ probeRejectionLeavesTrace: true }, [CASE.l7Probes], { invalidTexts: [] }));
  test("an import that commits the open label editor → exactly the L1 interaction case", () =>
    expectFailures({ commitInteractionOnImport: true }, [CASE.l1Interaction]));

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

describe("variants that miss a RECOMMENDATION fail nothing and advise exactly once", () => {
  /** no failure anywhere, and one advisory — from the case that checks the recommendation */
  const expectAdvisoryOnly = async (flaws: Flaws, caseName: string) => {
    const h = harness(flaws);
    expect(await failingCases(h)).toEqual([]);
    expect((await advisories(h)).map(([name]) => name)).toEqual([caseName]);
  };

  test("per-instance counter ids (event_1 on both peers) → an advisory from the collision case", () =>
    expectAdvisoryOnly({ counterIds: true }, CASE.elementsCollision));
  test("an import that drops the open label editor instead of reopening it → an advisory from the L1 interaction case", () =>
    expectAdvisoryOnly({ dropInteractionOnImport: true }, CASE.l1Interaction));
});
