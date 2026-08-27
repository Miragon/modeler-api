/**
 * The conformance test kit — every law of the CollaborativeModeler contract
 * as an executable case. A modeler repo supplies a small HARNESS (how to
 * create an instance, canonical sample texts, one scripted user mutation)
 * and binds the cases to its own test runner:
 *
 *   import { conformanceCases, registerConformance } from "@miragon/modeler-api/conformance";
 *   registerConformance(harness, test);            // node:test, vitest, jest — any (name, fn) runner
 *
 * Cases throw plain Errors on violation, so the kit has no runner or
 * assertion-library dependency.
 */
import { type CollaborativeModeler, MODELER_API_VERSION } from "./index.js";

export interface ConformanceHarness {
  /** a fresh modeler, attached to a suitable host element */
  create(): Promise<CollaborativeModeler>;
  /**
   * CANONICAL sample documents of the notation (>= 1, ideally several,
   * covering config/axis content too) — exactly what exportText emits
   */
  canonicalTexts: string[];
  /** importable but non-canonical inputs (hand-authored variants); the kit
   *  verifies canonicalization is IDEMPOTENT on them, not byte-stable */
  looseTexts?: string[];
  /** NON-importable inputs (half-typed peer text, wrong notation) — the kit
   *  verifies importText REJECTS and leaves no trace (L7) */
  invalidTexts?: string[];
  /** importable documents carrying content the modeler does NOT understand
   *  (vendor extensions, unknown lines) — the kit verifies export stays
   *  total and the foreign content survives round-trips (L6) */
  foreignTexts?: string[];
  /** wait until deferred/debounced change events have been delivered —
   *  MUST outlast the modeler's event debounce; defaults to one macrotask */
  settle?(): Promise<void>;
  /** perform ONE user-visible atomic change through the modeler's own
   *  commands (create/move/edit an element — not a raw model poke) */
  mutate(modeler: CollaborativeModeler): Promise<void> | void;
  /** trigger the modeler's undo, when it has one */
  undo?(modeler: CollaborativeModeler): Promise<void> | void;
}

export interface ConformanceCase {
  name: string;
  run(harness: ConformanceHarness): Promise<void>;
}

function fail(message: string): never {
  throw new Error(`modeler-api conformance: ${message}`);
}

function majorOf(version: string): string {
  return version.split(".")[0] ?? "";
}

function exportOrFail(modeler: CollaborativeModeler, when: string): string {
  try {
    return modeler.exportText();
  } catch (e) {
    fail(`exportText threw ${when}: ${String(e)}`);
  }
}

const defaultSettle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** count invocations of onContentChanged around an action — settle-aware, so
 *  debounced engines neither hide an echo nor fail a legitimate event */
async function changeEvents(
  harness: ConformanceHarness,
  modeler: CollaborativeModeler,
  action: () => Promise<void> | void,
): Promise<number> {
  const settle = harness.settle ?? defaultSettle;
  let calls = 0;
  const off = modeler.onContentChanged(() => {
    calls += 1;
  });
  try {
    await action();
    await settle();
  } finally {
    off();
  }
  return calls;
}

export function conformanceCases(): ConformanceCase[] {
  return [
    {
      name: "meta declares the notation and a compatible apiVersion",
      async run(h) {
        const m = await h.create();
        try {
          if (!m.meta.notation) fail("meta.notation is empty");
          if (majorOf(m.meta.apiVersion) !== majorOf(MODELER_API_VERSION)) {
            fail(`apiVersion ${m.meta.apiVersion} is not major-compatible with ${MODELER_API_VERSION}`);
          }
        } finally {
          m.destroy();
        }
      },
    },
    {
      name: "L1: importText is silent (no change events, for canonical and loose inputs)",
      async run(h) {
        const m = await h.create();
        try {
          for (const text of [...h.canonicalTexts, ...(h.looseTexts ?? [])]) {
            const calls = await changeEvents(h, m, () => m.importText(text).then(() => undefined));
            if (calls > 0) fail(`importText fired onContentChanged ${calls}x`);
          }
        } finally {
          m.destroy();
        }
      },
    },
    {
      name: "L2: canonical texts are byte fixpoints of import → export",
      async run(h) {
        if (h.canonicalTexts.length === 0) fail("harness provides no canonicalTexts");
        const m = await h.create();
        try {
          for (const text of h.canonicalTexts) {
            await m.importText(text);
            const out = m.exportText();
            if (out !== text)
              fail(`export after import differs from the canonical input:\n--- in\n${text}\n--- out\n${out}`);
          }
        } finally {
          m.destroy();
        }
      },
    },
    {
      name: "L2: canonicalization of loose input is idempotent",
      async run(h) {
        const loose = h.looseTexts ?? [];
        if (loose.length === 0) return; // nothing to verify — notation has no loose form
        const m = await h.create();
        try {
          for (const text of loose) {
            await m.importText(text);
            const canonical = m.exportText();
            await m.importText(canonical);
            const again = m.exportText();
            if (again !== canonical) fail("canonicalization is not idempotent on loose input");
          }
        } finally {
          m.destroy();
        }
      },
    },
    {
      name: "L3: a scripted user mutation fires onContentChanged (and changes the export)",
      async run(h) {
        const m = await h.create();
        try {
          await m.importText(h.canonicalTexts[0] ?? "");
          const before = m.exportText();
          const calls = await changeEvents(h, m, () => h.mutate(m));
          if (calls === 0) fail("a user mutation fired no onContentChanged");
          if (m.exportText() === before)
            fail("the harness mutation did not change the export — the case proves nothing");
        } finally {
          m.destroy();
        }
      },
    },
    {
      name: "L3: unsubscribe stops delivery",
      async run(h) {
        const m = await h.create();
        try {
          await m.importText(h.canonicalTexts[0] ?? "");
          let calls = 0;
          const off = m.onContentChanged(() => {
            calls += 1;
          });
          off();
          await h.mutate(m);
          await (h.settle ?? defaultSettle)();
          if (calls > 0) fail("onContentChanged delivered after unsubscribe");
        } finally {
          m.destroy();
        }
      },
    },
    {
      name: "L4: undo directly after an import is a no-op",
      async run(h) {
        if (!h.undo) return; // notation without undo — law is vacuous
        const first = h.canonicalTexts[0];
        const second = h.canonicalTexts[1];
        if (first === undefined || second === undefined || first === second) {
          fail("the L4 case needs TWO DISTINCT canonicalTexts — with one, stale undo is undetectable");
        }
        const m = await h.create();
        try {
          await m.importText(first);
          await h.mutate(m); // real history exists…
          await h.mutate(m); // …more than one entry deep…
          await m.importText(second); // …then a remote state replaces the doc
          // baseline via the modeler's OWN serializer: this case isolates the
          // undo law — a non-canonical serializer must fail L2, not here
          const baseline = m.exportText();
          await h.undo(m);
          await h.undo(m); // drain a stale multi-entry history too
          if (m.exportText() !== baseline) {
            fail("undo after importText mutated the freshly imported document (stale history applied)");
          }
        } finally {
          m.destroy();
        }
      },
    },
    {
      name: "L5: view state round-trips across a re-import — and is not document content",
      async run(h) {
        const m = await h.create();
        try {
          const text = h.canonicalTexts[0] ?? "";
          await m.importText(text);
          const doc = m.exportText();
          const state = m.getViewState();
          await m.importText(text);
          const calls = await changeEvents(h, m, () => m.setViewState(state));
          if (calls > 0) fail("setViewState fired onContentChanged — view state is not document content");
          if (m.exportText() !== doc)
            fail("setViewState changed the export — view state leaked into the document");
          const after = m.getViewState();
          if (JSON.stringify(after) !== JSON.stringify(state)) {
            fail("view state did not survive re-import + restore");
          }
        } finally {
          m.destroy();
        }
      },
    },
    {
      name: "elements (when present): stable ids across re-import, reveal semantics",
      async run(h) {
        const m = await h.create();
        try {
          const text = h.canonicalTexts[0] ?? "";
          await m.importText(text);
          if (!m.elements) return; // surface is optional
          const ids = m.elements.list().map((e) => e.id);
          if (new Set(ids).size !== ids.length) fail("element ids are not unique");
          await m.importText(text);
          const again = m.elements.list().map((e) => e.id);
          if (JSON.stringify([...ids].sort()) !== JSON.stringify([...again].sort())) {
            fail("element ids are not stable across re-imports of the same text");
          }
          if (m.elements.reveal("__modeler_api_no_such_id__") !== false) {
            fail("reveal(unknown id) must return false");
          }
          const firstId = ids[0];
          if (firstId !== undefined) {
            const calls = await changeEvents(h, m, () => {
              if (m.elements?.reveal(firstId) !== true) fail("reveal(known id) must return true");
            });
            if (calls > 0) fail("reveal fired onContentChanged — revealing is view behavior, not an edit");
          }
        } finally {
          m.destroy();
        }
      },
    },
    {
      name: "L6: export is total and foreign content survives round-trips",
      async run(h) {
        const m = await h.create();
        try {
          for (const text of h.foreignTexts ?? []) {
            await m.importText(text); // warnings allowed — a throw is the violation
            const first = exportOrFail(m, "after importing a document with foreign content");
            await m.importText(first);
            const second = exportOrFail(m, "after re-importing its own export of foreign content");
            if (second !== first) fail("foreign content did not survive an import → export round-trip");
          }
          // export stays total through user commands and undo, too
          await m.importText(h.canonicalTexts[0] ?? "");
          await h.mutate(m);
          exportOrFail(m, "after a user mutation");
          if (h.undo) {
            await h.undo(m);
            exportOrFail(m, "after an undo");
          }
        } finally {
          m.destroy();
        }
      },
    },
    {
      name: "L7: a rejected import leaves no trace",
      async run(h) {
        const invalid = h.invalidTexts ?? [];
        if (invalid.length === 0) return; // notation without invalid forms — law is vacuous
        const m = await h.create();
        try {
          const text = h.canonicalTexts[0] ?? "";
          await m.importText(text);
          const doc = m.exportText();
          for (const bad of invalid) {
            let rejected = false;
            const calls = await changeEvents(h, m, () =>
              m.importText(bad).then(
                () => undefined,
                () => {
                  rejected = true;
                },
              ),
            );
            if (!rejected) fail("importText resolved for a non-importable input — it must REJECT");
            if (calls > 0) fail("a rejected import fired onContentChanged");
            if (m.exportText() !== doc) {
              fail("a rejected import changed the document — the previous state must stay intact");
            }
          }
        } finally {
          m.destroy();
        }
      },
    },
    {
      name: "destroy is safe to call twice",
      async run(h) {
        const m = await h.create();
        m.destroy();
        m.destroy(); // must not throw
      },
    },
  ];
}

/** bind every case to a (name, fn) test runner — node:test, vitest, jest */
export function registerConformance(
  harness: ConformanceHarness,
  test: (name: string, fn: () => Promise<void>) => unknown,
): void {
  for (const conformanceCase of conformanceCases()) {
    test(`conformance: ${conformanceCase.name}`, () => conformanceCase.run(harness));
  }
}
