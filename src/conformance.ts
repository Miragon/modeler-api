/**
 * The conformance test kit — every law of the CollaborativeModeler contract
 * as an executable case. A modeler repo supplies a small HARNESS (how to
 * create an instance, canonical sample texts, scripted user mutations) and
 * binds the cases to its own test runner:
 *
 *   import { conformanceCases, registerConformance } from "@miragon/modeler-api/conformance";
 *   registerConformance(harness, test);            // node:test, vitest, jest — any (name, fn) runner
 *
 * Cases throw plain Errors on violation, so the kit has no runner or
 * assertion-library dependency. A case that CANNOT (fully) run because the
 * harness left an optional field undefined resolves with `{ skipped }` and
 * registerConformance reports it (console.warn by default) — a law the kit
 * did not verify is never a silent green.
 */
import { type CollaborativeModeler, MODELER_API_VERSION } from "./index.js";

export interface UserMutation {
  /** names the failing mutation in the kit's error message */
  name: string;
  run(modeler: CollaborativeModeler): Promise<void> | void;
}

export interface ConformanceHarness {
  /**
   * a fresh EDITABLE modeler, attached to a host element that is IN the
   * document with a non-zero size (`attachedHost()` below) — diagram-js
   * engines compute viewboxes from the host's client size, so a detached
   * or 0×0 host yields NaN view state; they also need a real browser
   * (vitest browser mode / Playwright), jsdom has no getBBox
   */
  create(): Promise<CollaborativeModeler>;
  /** a fresh READ-ONLY instance (`meta.editable === false`) — the viewer
   *  mount hosts use on read-only surfaces; absent = the package ships no
   *  viewer and the viewer case is reported as skipped */
  createReadonly?(): Promise<CollaborativeModeler>;
  /**
   * CANONICAL sample documents of the notation (>= 2, distinct, at least one
   * rendering an element, ideally several covering config/axis content too)
   * — exactly what exportText emits. Obtain them by exporting a hand-authored
   * document and REVIEWING the bytes, not by pasting whatever the current
   * build prints: L2 only proves the serializer is a fixpoint of the texts
   * you vouch for
   */
  canonicalTexts: string[];
  /** importable but non-canonical inputs (hand-authored variants); the kit
   *  verifies canonicalization is IDEMPOTENT on them, not byte-stable.
   *  `undefined` = skipped; `[]` = the notation has no loose form */
  looseTexts?: string[];
  /**
   * NON-importable inputs (half-typed peer text, wrong notation) — the kit
   * verifies importText REJECTS, leaves no trace and stays usable (L7).
   * `undefined` = not provided (the L7 cases report a SKIP); `[]` = the
   * deliberate statement that this notation has no non-importable text
   * (the lenient line DSLs keep every line, so nothing rejects)
   */
  invalidTexts?: string[];
  /**
   * importable documents carrying content the modeler does NOT understand
   * (vendor extensions, unknown lines, unknown JSON keys), each with the
   * fragments that must come back from an import → export round-trip (L6).
   * `undefined` = skipped; `[]` = the notation has no foreign form
   */
  foreignTexts?: Array<{ text: string; mustSurvive: string[] }>;
  /**
   * a NON-default view state the modeler accepts — a panned/zoomed viewport
   * (e.g. a viewbox) that differs from what an import leaves; L5 cannot tell
   * a restore from a no-op without one. The kit never compares a readback
   * with this literal: it sets it, reads the modeler's own (possibly
   * normalised) state back, and requires THAT to survive a re-import and to
   * be settable itself. `undefined` = L5 is reported as skipped
   */
  viewState?: unknown;
  /** wait until deferred/debounced change events have been delivered —
   *  MUST outlast the modeler's event debounce; defaults to one macrotask */
  settle?(): Promise<void>;
  /**
   * perform ONE user-visible atomic ELEMENT command through the modeler's
   * own commands: ADD an element — never rename or delete one (the elements
   * case treats it as an edit unrelated to the existing elements, and L4
   * builds undo history from it, so it must be undoable)
   */
  mutate(modeler: CollaborativeModeler): Promise<void> | void;
  /**
   * user-visible changes that do NOT run through an element command:
   * config/axis/title/style/size edits that live in the document. A notation
   * with such surfaces MUST list them — the kit cannot see what the canvas
   * offers, and a modeler that only forwards its command stack passes
   * `mutate` while a host loses exactly these edits. `undefined` = skipped;
   * `[]` = the notation has no such surface
   */
  configMutations?: UserMutation[];
  /** trigger the modeler's undo; `undefined` = the notation has no undo
   *  (the undo cases are reported as skipped) */
  undo?(modeler: CollaborativeModeler): Promise<void> | void;
  /** trigger the modeler's redo; `undefined` with `undo` defined = the redo
   *  half of the undo/redo case is reported as skipped */
  redo?(modeler: CollaborativeModeler): Promise<void> | void;
}

export interface CaseOutcome {
  /** the case could not (fully) verify its law — the harness left the field
   *  it needs undefined, or the modeler has no such optional surface; the
   *  reason names which */
  skipped?: string;
}

export interface ConformanceCase {
  name: string;
  run(harness: ConformanceHarness): Promise<CaseOutcome | void>;
}

/**
 * a host element of the given size, attached to the document — what
 * `create()` should mount into (browser only). The returned element sits
 * INSIDE a sized wrapper: the Miragon renderers restyle the container they
 * are given to 100% × 100%, which then resolves against the wrapper
 */
export function attachedHost(width = 800, height = 600): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `width:${width}px;height:${height}px;position:absolute;left:0;top:0;overflow:hidden`;
  const host = document.createElement("div");
  host.style.cssText = "width:100%;height:100%";
  wrapper.append(host);
  document.body.append(wrapper);
  return host;
}

/**
 * apiVersion compatibility: same major — and, while the contract is 0.x,
 * the same minor too (pre-1.0 minors may break; bump-minor-pre-major)
 */
export function apiVersionsCompatible(a: string, b: string): boolean {
  const [aMajor = "", aMinor = ""] = a.split(".");
  const [bMajor = "", bMinor = ""] = b.split(".");
  if (aMajor !== bMajor) return false;
  return aMajor !== "0" || aMinor === bMinor;
}

function fail(message: string): never {
  throw new Error(`modeler-api conformance: ${message}`);
}

const skip = (reason: string): CaseOutcome => ({ skipped: reason });

function exportOrFail(modeler: CollaborativeModeler, when: string): string {
  try {
    return modeler.exportText();
  } catch (e) {
    fail(`exportText threw ${when}: ${String(e)}`);
  }
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** a view state with NaN/Infinity is what a detached or 0×0 host produces */
function assertFinite(state: unknown, when: string): void {
  const json = JSON.stringify(state, (_k, v: unknown) =>
    typeof v === "number" && !Number.isFinite(v) ? "__non_finite__" : v,
  );
  if (json?.includes("__non_finite__")) {
    fail(
      `getViewState() ${when} contains a non-finite number — the host has no size (mount into attachedHost())`,
    );
  }
}

const defaultSettle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** count invocations of onContentChanged around an action — settle-aware, so
 *  debounced engines neither hide an echo nor fail a legitimate event; the
 *  export seen INSIDE the last delivery is returned too (L3's ordering rule) */
async function changeEvents(
  harness: ConformanceHarness,
  modeler: CollaborativeModeler,
  action: () => Promise<void> | void,
): Promise<{ calls: number; exportAtEmit: string | undefined }> {
  const settle = harness.settle ?? defaultSettle;
  let calls = 0;
  let exportAtEmit: string | undefined;
  const off = modeler.onContentChanged(() => {
    calls += 1;
    exportAtEmit = modeler.exportText();
  });
  try {
    await action();
    await settle();
  } finally {
    off();
  }
  return { calls, exportAtEmit };
}

const secondText = (h: ConformanceHarness): string => h.canonicalTexts[1] ?? h.canonicalTexts[0] ?? "";

/** the harness's user mutations: the element command first, then every config edit */
const mutationsOf = (h: ConformanceHarness): UserMutation[] => [
  { name: "mutate (element command)", run: (m) => h.mutate(m) },
  ...(h.configMutations ?? []),
];

const sortedIds = (m: CollaborativeModeler): string[] | undefined =>
  m.elements ? [...m.elements.list().map((e) => e.id)].sort() : undefined;

/**
 * import the first canonical text that renders at least one element (an
 * empty document has no fitted view — renderers leave the viewport alone),
 * and return it; without an elements surface the first text is used
 */
async function importContentText(h: ConformanceHarness, m: CollaborativeModeler): Promise<string> {
  for (const text of h.canonicalTexts) {
    await m.importText(text);
    if (!m.elements || m.elements.list().length > 0) return text;
  }
  fail("L5 needs a canonical text that renders at least one element — an empty document has no fitted view");
}

export function conformanceCases(): ConformanceCase[] {
  return [
    {
      name: "meta declares the notation, editability and a compatible apiVersion",
      async run(h) {
        const m = await h.create();
        try {
          if (!m.meta.notation) fail("meta.notation is empty");
          if (m.meta.editable !== true)
            fail("create() must return an EDITABLE modeler (meta.editable === true)");
          if (!apiVersionsCompatible(m.meta.apiVersion, MODELER_API_VERSION)) {
            fail(`apiVersion ${m.meta.apiVersion} is not compatible with ${MODELER_API_VERSION}`);
          }
        } finally {
          m.destroy();
        }
      },
    },
    {
      name: "L1: importText is silent (no change events, for canonical, loose and foreign inputs)",
      async run(h) {
        const m = await h.create();
        try {
          const texts = [
            ...h.canonicalTexts,
            ...(h.looseTexts ?? []),
            ...(h.foreignTexts ?? []).map((f) => f.text),
          ];
          for (const text of texts) {
            const { calls } = await changeEvents(h, m, () => m.importText(text).then(() => undefined));
            if (calls > 0) fail(`importText fired onContentChanged ${calls}x`);
          }
        } finally {
          m.destroy();
        }
      },
    },
    {
      name: "L1: importText over EXISTING undo history is silent too",
      async run(h) {
        // diagram-js' commandStack.clear() emits 'changed' whether or not the
        // stack is empty — but an engine that only emits when it has something
        // to clear would pass the fresh-instance case above
        const m = await h.create();
        try {
          await m.importText(h.canonicalTexts[0] ?? "");
          await h.mutate(m);
          await (h.settle ?? defaultSettle)();
          const { calls } = await changeEvents(h, m, () => m.importText(secondText(h)).then(() => undefined));
          if (calls > 0) fail(`importText over a non-empty undo history fired onContentChanged ${calls}x`);
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
            if (m.exportText() !== out)
              fail("exportText is not deterministic — two exports of one document differ");
          }
        } finally {
          m.destroy();
        }
      },
    },
    {
      name: "L2: canonicalization of loose input is idempotent",
      async run(h) {
        if (h.looseTexts === undefined)
          return skip("looseTexts is undefined — pass [] if the notation has no loose form");
        if (h.looseTexts.length === 0) return;
        const m = await h.create();
        try {
          for (const text of h.looseTexts) {
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
      name: "L3: a scripted user mutation fires onContentChanged, and the export already reflects it inside the listener",
      async run(h) {
        const m = await h.create();
        try {
          await m.importText(h.canonicalTexts[0] ?? "");
          const before = m.exportText();
          const { calls, exportAtEmit } = await changeEvents(h, m, () => h.mutate(m));
          if (calls === 0) fail("a user mutation fired no onContentChanged");
          const after = m.exportText();
          if (after === before)
            fail("the harness mutation did not change the export — the case proves nothing");
          if (exportAtEmit !== after) {
            fail(
              "exportText() inside the onContentChanged listener did not return the post-change document (emit before apply)",
            );
          }
        } finally {
          m.destroy();
        }
      },
    },
    {
      name: "L3: config/axis edits fire onContentChanged too, with the export already updated",
      async run(h) {
        if (h.configMutations === undefined) {
          return skip(
            "configMutations is undefined — pass [] if the notation has no config/axis/title surface",
          );
        }
        for (const mutation of h.configMutations) {
          const m = await h.create();
          try {
            await m.importText(h.canonicalTexts[0] ?? "");
            const before = m.exportText();
            const { calls, exportAtEmit } = await changeEvents(h, m, () => mutation.run(m));
            if (calls === 0) fail(`config mutation "${mutation.name}" fired no onContentChanged`);
            const after = m.exportText();
            if (after === before) {
              fail(`config mutation "${mutation.name}" did not change the export — the case proves nothing`);
            }
            if (exportAtEmit !== after) {
              fail(
                `exportText() inside the listener of config mutation "${mutation.name}" did not return the post-change document`,
              );
            }
          } finally {
            m.destroy();
          }
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
      name: "L3: undo and redo fire onContentChanged and restore the export",
      async run(h) {
        if (!h.undo) return skip("undo is undefined — the notation declares no undo");
        const undo = h.undo;
        const m = await h.create();
        try {
          await m.importText(h.canonicalTexts[0] ?? "");
          const before = m.exportText();
          await h.mutate(m);
          await (h.settle ?? defaultSettle)();
          const mutated = m.exportText();
          const undone = await changeEvents(h, m, () => undo(m));
          if (undone.calls === 0)
            fail("undo fired no onContentChanged — the host would never export the undone state");
          if (m.exportText() !== before)
            fail("undo of a single mutation did not restore the pre-mutation export");
          if (undone.exportAtEmit !== before)
            fail("exportText() inside the undo listener did not return the undone document");
          if (!h.redo)
            return skip(
              "redo is undefined — the redo half of this case was not verified (pass redo to verify it)",
            );
          const redo = h.redo;
          const redone = await changeEvents(h, m, () => redo(m));
          if (redone.calls === 0) fail("redo fired no onContentChanged");
          if (m.exportText() !== mutated) fail("redo did not restore the mutated export");
          if (redone.exportAtEmit !== mutated)
            fail("exportText() inside the redo listener did not return the redone document");
        } finally {
          m.destroy();
        }
      },
    },
    {
      name: "L4: undo directly after an import is a no-op",
      async run(h) {
        if (!h.undo) return skip("undo is undefined — the notation declares no undo");
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
          // leg 1 — GUARANTEED id coincidence: re-import the mutated document
          // itself. A stale diagram-js stack whose revert removes the created
          // shape by id is a silent no-op on any other document and deletes a
          // re-imported element on this one — the tt drift as it really bites
          const mutated = m.exportText();
          await m.importText(mutated);
          const baselineSame = m.exportText();
          const idsSame = sortedIds(m);
          const { calls } = await changeEvents(h, m, () => h.undo!(m));
          if (calls > 0)
            fail(
              "undo directly after importText fired onContentChanged — history housekeeping is not a change",
            );
          if (m.exportText() !== baselineSame || (idsSame && !same(idsSame, sortedIds(m)))) {
            fail(
              "undo after importText removed a re-imported element by id coincidence (stale history applied)",
            );
          }
          // leg 2 — a DIFFERENT document replaces the doc; a snapshot-restoring
          // stale stack would resurrect the previous one
          await h.mutate(m);
          await m.importText(second);
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
      name: "L5: getViewState never throws before the first import",
      async run(h) {
        const m = await h.create();
        try {
          let state: unknown;
          try {
            state = m.getViewState();
          } catch (e) {
            fail(`getViewState threw before the first import: ${String(e)}`);
          }
          if (state !== undefined) assertFinite(state, "before the first import");
        } finally {
          m.destroy();
        }
      },
    },
    {
      name: "L5: view state round-trips across a re-import, an import fits the view — and none of it is document content",
      async run(h) {
        if (h.viewState === undefined) {
          return skip(
            "viewState is undefined — supply a panned/zoomed state, a no-op setViewState is otherwise undetectable",
          );
        }
        const alt = h.viewState;
        const m = await h.create();
        try {
          const text = await importContentText(h, m);
          const doc = m.exportText();
          const fitted = m.getViewState();
          assertFinite(fitted, "after the first import");
          // the modeler's OWN readback is the oracle from here on — a
          // diagram-js viewbox comes back rounded and enriched (scale, inner,
          // outer), never byte-equal to the harness literal
          m.setViewState(alt);
          const applied = m.getViewState();
          assertFinite(applied, "after setViewState");
          if (same(applied, fitted)) {
            fail("setViewState(viewState) had no effect — supply a state that differs from the fitted view");
          }
          await m.importText(text);
          if (!same(m.getViewState(), fitted)) {
            fail(
              "an import must leave the view FITTED to the content (the same state the first import produced)",
            );
          }
          // the host restores with what IT read back before the re-import —
          // the readback must be settable and yield itself again
          const { calls } = await changeEvents(h, m, () => m.setViewState(applied));
          if (calls > 0) fail("setViewState fired onContentChanged — view state is not document content");
          if (m.exportText() !== doc)
            fail("setViewState changed the export — view state leaked into the document");
          if (!same(m.getViewState(), applied)) {
            fail(
              "view state did not survive re-import + restore (setting the modeler's own readback must yield that readback)",
            );
          }
        } finally {
          m.destroy();
        }
      },
    },
    {
      name: "elements (when present): stable ids across re-imports and unrelated edits, reveal and selection semantics",
      async run(h) {
        const m = await h.create();
        try {
          const text = h.canonicalTexts[0] ?? "";
          await m.importText(text);
          const elements = m.elements;
          if (!elements)
            return skip("the modeler exposes no elements surface (optional) — nothing to verify");
          const ids = elements.list().map((e) => e.id);
          if (new Set(ids).size !== ids.length) fail("element ids are not unique");
          await m.importText(text);
          const again = elements.list().map((e) => e.id);
          if (!same([...ids].sort(), [...again].sort()))
            fail("element ids are not stable across re-imports of the same text");
          if (elements.reveal("__modeler_api_no_such_id__") !== false)
            fail("reveal(unknown id) must return false");
          const firstId = ids[0];
          if (firstId !== undefined) {
            const deliveries: string[][] = [];
            const off = elements.onSelection((selected) => deliveries.push([...selected]));
            const { calls } = await changeEvents(h, m, () => {
              if (elements.reveal(firstId) !== true) fail("reveal(known id) must return true");
            });
            if (calls > 0) fail("reveal fired onContentChanged — revealing is view behavior, not an edit");
            if (!deliveries.some((d) => d.includes(firstId))) {
              fail(
                `reveal('${firstId}') delivered no selection containing the id — is it a selectable element (not a root or a label)?`,
              );
            }
            for (const d of deliveries) {
              for (const id of d) {
                if (!again.includes(id)) {
                  fail(
                    `onSelection reported an id that is not an element: '${id}' (label ids must resolve to their target)`,
                  );
                }
              }
            }
            if (!elements.selection().includes(firstId)) fail("selection() does not contain the revealed id");
            const seen = deliveries.length;
            off();
            // a DIFFERENT selection after the unsubscribe — re-revealing the
            // same id would be deduplicated by many engines and prove nothing
            const otherId = ids[1];
            if (otherId !== undefined) elements.reveal(otherId);
            else await h.mutate(m);
            await (h.settle ?? defaultSettle)();
            if (deliveries.length !== seen) fail("onSelection delivered after unsubscribe");
          }
          // an edit to ANOTHER element must not renumber existing ids: every id
          // still exists AND (where the notation has names) still names the
          // same element — a positional scheme keeps the id strings while
          // shifting what they point at
          const namesBefore = new Map(elements.list().map((e) => [e.id, e.name]));
          await h.mutate(m);
          await (h.settle ?? defaultSettle)();
          const afterEdit = new Map(elements.list().map((e) => [e.id, e.name]));
          if (afterEdit.size <= namesBefore.size) {
            fail(
              "the harness mutate must ADD an element (the elements case verifies ids under an unrelated edit)",
            );
          }
          for (const [id, name] of namesBefore) {
            if (!afterEdit.has(id)) {
              fail(
                `element id '${id}' vanished after an unrelated edit — ids must survive edits to other elements`,
              );
            }
            if (name !== undefined && afterEdit.get(id) !== name) {
              fail(
                `element id '${id}' names a different element after an unrelated edit ('${name}' → '${String(afterEdit.get(id))}')`,
              );
            }
          }
        } finally {
          m.destroy();
        }
      },
    },
    {
      name: "L6: export is total after imports, user mutations and undo",
      async run(h) {
        const m = await h.create();
        try {
          await m.importText(h.canonicalTexts[0] ?? "");
          for (const mutation of mutationsOf(h)) {
            await mutation.run(m);
            exportOrFail(m, `after ${mutation.name}`);
          }
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
      name: "L6: foreign content survives an import → export round-trip",
      async run(h) {
        if (h.foreignTexts === undefined) {
          return skip("foreignTexts is undefined — pass [] if the notation has no foreign form");
        }
        if (h.foreignTexts.length === 0) return;
        const m = await h.create();
        try {
          await foreignRoundTrips(h, m, "");
        } finally {
          m.destroy();
        }
      },
    },
    {
      name: "L7: a rejected import leaves no trace",
      async run(h) {
        if (h.invalidTexts === undefined) {
          return skip("invalidTexts is undefined — pass [] if the notation has no non-importable text");
        }
        if (h.invalidTexts.length === 0) return;
        const m = await h.create();
        try {
          const text = h.canonicalTexts[0] ?? "";
          await m.importText(text);
          const beforeEdit = m.exportText();
          // with undo history on the stack: a rejected import must leave it
          // intact too (an engine that erases history BEFORE parsing does not)
          if (h.undo) {
            await h.mutate(m);
            await (h.settle ?? defaultSettle)();
          }
          const doc = m.exportText();
          const ids = sortedIds(m);
          for (const bad of h.invalidTexts) {
            let rejected = false;
            const { calls } = await changeEvents(h, m, () =>
              m.importText(bad).then(
                () => undefined,
                () => {
                  rejected = true;
                },
              ),
            );
            if (!rejected) fail("importText resolved for a non-importable input — it must REJECT");
            if (calls > 0) fail("a rejected import fired onContentChanged");
            if (m.exportText() !== doc)
              fail("a rejected import changed the document — the previous state must stay intact");
            if (ids && !same(ids, sortedIds(m))) {
              fail(
                "a rejected import changed the rendered elements — the canvas must keep the previous document",
              );
            }
          }
          if (h.undo) {
            await h.undo(m);
            if (m.exportText() !== beforeEdit) {
              fail(
                "a rejected import erased the undo history — the previous document's history must stay intact",
              );
            }
          }
        } finally {
          m.destroy();
        }
      },
    },
    {
      name: "L7: the modeler stays usable after a rejected import",
      async run(h) {
        if (h.invalidTexts === undefined) {
          return skip("invalidTexts is undefined — pass [] if the notation has no non-importable text");
        }
        const bad = h.invalidTexts[0];
        if (bad === undefined) return;
        const m = await h.create();
        try {
          await m.importText(h.canonicalTexts[0] ?? "");
          await m.importText(bad).then(
            () => fail("importText resolved for a non-importable input — it must REJECT"),
            () => undefined,
          );
          const next = secondText(h);
          await m
            .importText(next)
            .catch((e) => fail(`the next VALID import after a rejection did not render: ${String(e)}`));
          if (m.exportText() !== next)
            fail("the next valid import after a rejection did not replace the document");
          const before = m.exportText();
          const { calls } = await changeEvents(h, m, () => h.mutate(m));
          if (calls === 0) fail("a user mutation after a rejected import fired no onContentChanged (wedged)");
          if (exportOrFail(m, "after a mutation that followed a rejected import") === before) {
            fail("a user mutation after a rejected import did not apply (wedged)");
          }
          if (h.undo) {
            await h.undo(m);
            exportOrFail(m, "after an undo that followed a rejected import");
          }
        } finally {
          m.destroy();
        }
      },
    },
    {
      name: "viewer (when shipped): read-only, silent, canonical, fits, reveals, keeps foreign content, unshaken by a rejected import",
      async run(h) {
        if (!h.createReadonly) return skip("createReadonly is undefined — the package ships no viewer mount");
        const v = await h.createReadonly();
        try {
          if (v.meta.editable !== false)
            fail("createReadonly() must return a viewer (meta.editable === false)");
          try {
            const fresh = v.getViewState();
            if (fresh !== undefined) assertFinite(fresh, "on the viewer before the first import");
          } catch (e) {
            fail(`the viewer's getViewState threw before the first import: ${String(e)}`);
          }
          let calls = 0;
          const off = v.onContentChanged(() => {
            calls += 1;
          });
          try {
            for (const text of h.canonicalTexts) {
              await v
                .importText(text)
                .catch((e) => fail(`the viewer rejected a canonical text: ${String(e)}`));
              if (exportOrFail(v, "on the viewer") !== text)
                fail("the viewer's export is not the canonical text");
            }
            const doc = v.exportText();
            const ids = sortedIds(v);
            if (v.elements) {
              const firstId = v.elements.list()[0]?.id;
              if (firstId !== undefined) {
                const deliveries: string[][] = [];
                const offSel = v.elements.onSelection((s) => deliveries.push([...s]));
                if (v.elements.reveal(firstId) !== true)
                  fail("the viewer's reveal(known id) must return true");
                await (h.settle ?? defaultSettle)();
                if (!deliveries.some((d) => d.includes(firstId)))
                  fail("the viewer's reveal delivered no selection containing the id");
                if (!v.elements.selection().includes(firstId))
                  fail("the viewer's selection() does not contain the revealed id");
                offSel();
              }
              if (v.elements.reveal("__modeler_api_no_such_id__") !== false)
                fail("the viewer's reveal(unknown id) must return false");
            }
            for (const bad of h.invalidTexts ?? []) {
              await v.importText(bad).then(
                () => fail("the viewer resolved a non-importable input — it must REJECT"),
                () => undefined,
              );
              if (v.exportText() !== doc) fail("a rejected import changed the viewer's document");
              if (ids && !same(ids, sortedIds(v)))
                fail("a rejected import changed the viewer's rendered elements");
            }
            await foreignRoundTrips(h, v, "the viewer's ");
            if (h.viewState !== undefined) {
              const text = await importContentText(h, v);
              const fitted = v.getViewState();
              assertFinite(fitted, "on the viewer after import");
              v.setViewState(h.viewState);
              const applied = v.getViewState();
              if (same(applied, fitted)) fail("the viewer's setViewState had no effect");
              await v.importText(text);
              if (!same(v.getViewState(), fitted))
                fail("the viewer's import must leave the view fitted (L5)");
              v.setViewState(applied);
              if (!same(v.getViewState(), applied))
                fail("setting the viewer's own readback did not yield that readback");
            }
            await (h.settle ?? defaultSettle)();
            if (calls > 0)
              fail(`the viewer fired onContentChanged ${calls}x — a viewer never changes content`);
          } finally {
            off();
          }
        } finally {
          v.destroy();
          v.destroy(); // must not throw — same as the editor
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

/** the L6 foreign-content round-trips, on an editor or a viewer */
async function foreignRoundTrips(h: ConformanceHarness, m: CollaborativeModeler, who: string): Promise<void> {
  for (const { text, mustSurvive } of h.foreignTexts ?? []) {
    if (mustSurvive.length === 0) fail("a foreignTexts entry must name at least one fragment in mustSurvive");
    await m.importText(text); // warnings allowed — a throw is the violation
    const first = exportOrFail(m, `${who}after importing a document with foreign content`);
    for (const fragment of mustSurvive) {
      if (!first.includes(fragment))
        fail(`${who}foreign content was dropped on import → export: '${fragment}' is missing`);
    }
    await m.importText(first);
    const second = exportOrFail(m, `${who}after re-importing its own export of foreign content`);
    if (second !== first) fail(`${who}foreign content did not survive a second import → export round-trip`);
  }
}

export interface RegisterOptions {
  /** how a SKIPPED case is reported — a law the kit could not (fully) verify
   *  because the harness left its field undefined. Default: console.warn */
  onSkip?: (caseName: string, reason: string) => void;
}

/** bind every case to a (name, fn) test runner — node:test, vitest, jest */
export function registerConformance(
  harness: ConformanceHarness,
  test: (name: string, fn: () => Promise<void>) => unknown,
  options: RegisterOptions = {},
): void {
  const onSkip =
    options.onSkip ??
    ((name: string, reason: string) => {
      console.warn(`modeler-api conformance: SKIPPED "${name}" — ${reason}`);
    });
  for (const conformanceCase of conformanceCases()) {
    test(`conformance: ${conformanceCase.name}`, async () => {
      const outcome = await conformanceCase.run(harness);
      if (outcome?.skipped) onSkip(conformanceCase.name, outcome.skipped);
    });
  }
}
