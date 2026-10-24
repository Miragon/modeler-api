import { TOOLTIP_DELAY_MS } from "../core/index.js";
import {
  DEFAULT_SIZES,
  HOVER_MARGIN_MS,
  LIGHT,
  PARK,
  assertHooksConsistent,
  closeByEscape,
  fail,
  finish,
  openHarness,
  pollUntil,
  shapes,
} from "./case-tools.js";
import { OVERLAY_LAYER_LIMIT, overlayLayerProblems } from "./checks.js";
import {
  canvasLayersProbe,
  contextPadEntriesProbe,
  holdWindowOpenProbe,
  labelEditorProbe,
  type CanvasLayersFacts,
} from "./facts.js";
import { DEFAULT_ROOT } from "./geometry.js";
import type { ShellConformanceCase, ShellConformanceHarness, ShellSkip } from "./harness.js";
import type { PageLike } from "./page.js";
import {
  canvasKeyProbe,
  inPage,
  removeInjectedProbe,
  settle,
  type CanvasKey,
} from "./page-tools.js";

/**
 * Room for an overlay to go once the pointer left its element (a hover tooltip), and for a popup
 * that closes after the view changed: diagram-js fires `canvas.viewbox.changed` up to 300ms late.
 */
const LAYER_WAIT_MS = TOOLTIP_DELAY_MS + HOVER_MARGIN_MS;

/** Room for the zoom to land before the kit looks again. */
const ZOOM_WAIT_MS = 1000;

const ZOOM_IN: CanvasKey = { key: "=", code: "Equal", ctrlKey: true };
const ZOOM_OUT: CanvasKey = { key: "-", code: "Minus", ctrlKey: true };

/** A context-pad entry the case leaves alone: it would take the element away. */
const DELETING_ENTRY = /delete|remove/i;

async function layers(
  page: PageLike,
  root: string,
  host: ShellConformanceHarness["host"],
): Promise<CanvasLayersFacts> {
  const facts = await inPage(page, canvasLayersProbe, { root, limit: OVERLAY_LAYER_LIMIT });
  if (!facts) fail("overlayLayers", host, [`no .djs-container inside the shell root "${root}"`]);
  return facts;
}

const viewOf = async (page: PageLike, root: string): Promise<string | null> =>
  (await inPage(page, labelEditorProbe, { root }))?.view ?? null;

/** Dispatches `key` at the canvas; whether the view changed within `ZOOM_WAIT_MS`. */
async function zoomBy(page: PageLike, root: string, key: CanvasKey): Promise<boolean> {
  const before = await viewOf(page, root);
  await inPage(page, canvasKeyProbe, { root, key });
  const after = await pollUntil(
    page,
    () => viewOf(page, root),
    (view) => view !== before,
    ZOOM_WAIT_MS,
  );
  return after !== before;
}

/**
 * The layers above the limit in the state the page is in, with the pointer parked, and which of
 * them are still there after a zoom at the canvas (Cmd/Ctrl+Plus, else Cmd/Ctrl+Minus); the zoom
 * is undone afterwards.
 */
async function layerProblems<P extends PageLike>(
  page: P,
  harness: ShellConformanceHarness<P>,
  root: string,
  state: string,
): Promise<string[]> {
  await page.mouse.move(PARK.x, PARK.y);
  const before = await pollUntil(
    page,
    () => layers(page, root, harness.host),
    (facts) => facts.layers.length === 0,
    LAYER_WAIT_MS,
  );
  if (before.layers.length === 0) return [];
  let undo: CanvasKey | undefined;
  if (await zoomBy(page, root, ZOOM_IN)) undo = ZOOM_OUT;
  else if (await zoomBy(page, root, ZOOM_OUT)) undo = ZOOM_IN;
  let after: CanvasLayersFacts | undefined;
  if (undo) {
    after = await pollUntil(
      page,
      () => layers(page, root, harness.host),
      (facts) => facts.layers.length === 0,
      LAYER_WAIT_MS,
    );
    await zoomBy(page, root, undo);
  }
  await settle(page);
  return overlayLayerProblems({
    state,
    palette: before.palette,
    before: before.layers,
    after: after ? after.layers : null,
  });
}

/** Selects `id` with a click unless it is selected; `false` when no pointer reaches it any more. */
async function select(page: PageLike, root: string, id: string): Promise<boolean> {
  const shape = (await shapes(page, root)).find((candidate) => candidate.id === id);
  if (!shape?.hit) return false;
  if (!shape.selected) {
    await page.mouse.click(shape.client.x, shape.client.y);
    await settle(page);
  }
  return true;
}

/**
 * Guide §5.13: what a modeler leaves in the canvas lies at `z-index` 100 or below, under the
 * palette at 110; only a popup that closes on a pan or zoom may cover it. As opened, with the label
 * editor open, with a shape selected and after a click on each of its context-pad entries (but a
 * deleting one), every layer of `.djs-container` above 100 must close when the view zooms.
 */
export const overlayLayersCase: ShellConformanceCase = {
  name: "overlayLayers",
  async run<P extends PageLike>(page: P, harness: ShellConformanceHarness<P>) {
    assertHooksConsistent("overlayLayers", harness, ["labelEditor"]);
    const root = harness.root ?? DEFAULT_ROOT;
    const size = (harness.sizes ?? DEFAULT_SIZES)[0] ?? DEFAULT_SIZES[0]!;
    const problems: string[] = [];
    const skipped: ShellSkip[] = [];
    await openHarness(page, harness, { size, requested: LIGHT });
    await settle(page);
    problems.push(...(await layerProblems(page, harness, root, "as opened")));

    const labelEditor = harness.labelEditor;
    if (labelEditor) {
      await labelEditor.open(page);
      await settle(page);
      problems.push(...(await layerProblems(page, harness, root, "with the label editor open")));
      await closeByEscape(page);
    } else if (!harness.absent?.includes("labelEditor")) {
      skipped.push({
        hook: "labelEditor",
        reason: "harness.labelEditor is undefined: the layer of the label editor was not verified",
      });
    }

    const shape = (await shapes(page, root)).find((candidate) => candidate.hit);
    if (shape && (await select(page, root, shape.id))) {
      problems.push(...(await layerProblems(page, harness, root, `with "${shape.id}" selected`)));
      const actions = (await inPage(page, contextPadEntriesProbe, { root }))
        .map((entry) => entry.action)
        .filter((action) => !DELETING_ENTRY.test(action));
      await inPage(page, holdWindowOpenProbe, null);
      try {
        for (const action of actions) {
          if (!(await select(page, root, shape.id))) break;
          const entry = (await inPage(page, contextPadEntriesProbe, { root })).find(
            (candidate) => candidate.action === action,
          );
          if (!entry) continue;
          await page.mouse.click(entry.client.x, entry.client.y);
          await settle(page);
          problems.push(
            ...(await layerProblems(
              page,
              harness,
              root,
              `after a click on context-pad entry "${action}" of "${shape.id}"`,
            )),
          );
          await closeByEscape(page);
        }
      } finally {
        await inPage(page, removeInjectedProbe, null);
      }
    } else {
      skipped.push({
        hook: "open",
        reason:
          "the opened document shows no shape a pointer reaches: the layers of a selection and of its context pad were not verified",
      });
    }
    return finish("overlayLayers", harness.host, problems, skipped);
  },
};
