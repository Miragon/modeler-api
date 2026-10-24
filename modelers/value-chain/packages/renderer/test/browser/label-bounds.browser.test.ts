import { afterEach, describe, expect, it } from "vitest";
import { attachedHost } from "@miragon/modeler-api/conformance";
import type Canvas from "diagram-js/lib/core/Canvas";
import type CommandStack from "diagram-js/lib/command/CommandStack";
import type ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import type Modeling from "diagram-js/lib/features/modeling/Modeling";
import type { Shape } from "diagram-js/lib/model/Types";
import {
  createCollaborativeModeler,
  createCollaborativeViewer,
  type CollaborativeValueChainModeler,
  type VcModeling,
  type VcShape,
} from "../../src/index.js";
import "../../src/assets/value-chain.css";

/**
 * Label text that overflows its shape is content (contract 1.3: everything the canvas draws): a
 * long label on the smallest step wraps into far more lines than the step holds and stands out
 * above and below it. The second step, far below, makes the chain tall, so every fit zooms out.
 */

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const LONG_LABEL =
  "Check the credit limit of the customer against every open order before the delivery is released";

const SMALL_STEP = { x: 0, y: 0, width: 80, height: 40 };

const TALL_CHAIN = JSON.stringify(
  {
    connections: [],
    elements: [
      { bounds: SMALL_STEP, elementType: "step", id: "step-credit", name: LONG_LABEL },
      {
        bounds: { x: 0, y: 1200, width: 160, height: 60 },
        elementType: "step",
        id: "step-ship",
        name: "Ship",
      },
    ],
    meta: { name: "Credit check" },
    schemaVersion: 1,
  },
  null,
  2,
);

/** What the box would be without the label: the two steps alone. */
const SHAPES_ONLY: Box = { x: 0, y: 0, width: 160, height: 1260 };

/** A box measured on the live SVG is float32; Chromium may round a glyph's edge to a pixel. */
const TOLERANCE = 1;

const mounted: CollaborativeValueChainModeler[] = [];

function mount(kind: "editor" | "viewer" = "editor"): CollaborativeValueChainModeler {
  const modeler = kind === "editor" ? createCollaborativeModeler() : createCollaborativeViewer();
  modeler.attachTo(attachedHost());
  mounted.push(modeler);
  return modeler;
}

afterEach(() => {
  for (const modeler of mounted.splice(0)) modeler.destroy();
});

function step(modeler: CollaborativeValueChainModeler): VcShape {
  return modeler.diagram.get<ElementRegistry>("elementRegistry").get("step-credit") as VcShape;
}

function labelText(modeler: CollaborativeValueChainModeler): SVGTextElement {
  return modeler.diagram
    .get<ElementRegistry>("elementRegistry")
    .getGraphics("step-credit")
    .querySelector("text")!;
}

/**
 * The box the label's glyphs cover in diagram coordinates, read at 100 %: Chromium lays SVG text
 * out at the zoomed font size, so only at 100 % does the live text have the size an export has.
 */
function drawnLabel(modeler: CollaborativeValueChainModeler): Box {
  modeler.diagram.get<Canvas>("canvas").zoom(1);
  const shape = step(modeler);
  const box = labelText(modeler).getBBox();
  return { x: shape.x + box.x, y: shape.y + box.y, width: box.width, height: box.height };
}

function expectInside(inner: Box | DOMRect, outer: Box | DOMRect | undefined): void {
  expect(outer).toBeDefined();
  expect(inner.x).toBeGreaterThanOrEqual(outer!.x - TOLERANCE);
  expect(inner.y).toBeGreaterThanOrEqual(outer!.y - TOLERANCE);
  expect(inner.x + inner.width).toBeLessThanOrEqual(outer!.x + outer!.width + TOLERANCE);
  expect(inner.y + inner.height).toBeLessThanOrEqual(outer!.y + outer!.height + TOLERANCE);
}

describe("label text that overflows its shape", () => {
  it("stands out above and below the small step it labels", async () => {
    const modeler = mount();
    await modeler.importText(TALL_CHAIN);
    const label = drawnLabel(modeler);
    expect(label.y).toBeLessThan(SMALL_STEP.y - 30);
    expect(label.y + label.height).toBeGreaterThan(SMALL_STEP.y + SMALL_STEP.height + 30);
  });

  it("is part of the content box, tight, editor and viewer alike", async () => {
    for (const modeler of [mount(), mount("viewer")]) {
      await modeler.importText(TALL_CHAIN);
      const label = drawnLabel(modeler);
      const content = modeler.contentBounds();
      expectInside(label, content);
      expectInside(SHAPES_ONLY, content);
      expect(content!.y).toBeCloseTo(label.y, 0);
      expect(content!.y + content!.height).toBe(SHAPES_ONLY.y + SHAPES_ONLY.height);
    }
  });

  it("keeps the content box across zoom and scroll, measured once per content change", async () => {
    const modeler = mount();
    await modeler.importText(TALL_CHAIN);
    const imported = modeler.contentBounds();
    const canvas = modeler.diagram.get<Canvas>("canvas");
    for (const zoom of [0.3, 2.5, 4]) {
      canvas.zoom(zoom);
      expect(modeler.contentBounds()).toEqual(imported);
    }
    modeler.setViewState({ x: 120, y: 80, width: 640, height: 480 });
    expect(modeler.contentBounds()).toEqual(imported);
  });

  it("follows the label through a rename, a move and an undo", async () => {
    const modeler = mount();
    await modeler.importText(TALL_CHAIN);
    const diagram = modeler.diagram;
    const overflowing = modeler.contentBounds()!;

    diagram.get<VcModeling>("vcModeling").updateLabel(step(modeler), "Credit");
    expect(modeler.contentBounds()).toEqual(SHAPES_ONLY);

    diagram.get<CommandStack>("commandStack").undo();
    expect(modeler.contentBounds()).toEqual(overflowing);

    diagram.get<Modeling>("modeling").moveShape(step(modeler) as Shape, { x: 0, y: 400 });
    const moved = modeler.contentBounds()!;
    expect(moved.y).toBeCloseTo(overflowing.y + 400, 6);
    expectInside(drawnLabel(modeler), moved);
  });

  it("shows all of it in the view the import fits", async () => {
    const modeler = mount();
    await modeler.importText(TALL_CHAIN);
    expect(modeler.diagram.get<Canvas>("canvas").zoom()).toBeLessThan(1);
    const view = modeler.diagram.container.getBoundingClientRect();
    expectInside(labelText(modeler).getBoundingClientRect(), view);
  });

  it("shows all of it in the SVG export", async () => {
    const modeler = mount();
    await modeler.importText(TALL_CHAIN);
    const sheet = document.createElement("div");
    sheet.style.cssText = "position:absolute;left:0;top:0";
    sheet.innerHTML = modeler.diagram.saveSVG().svg.replace(/^<\?xml[^>]*>\s*/, "");
    document.body.append(sheet);
    try {
      const exported = sheet.querySelector("svg")!;
      const text = exported.querySelector('[data-element-id="step-credit"] text')!;
      expect(text.textContent).toContain("Check");
      expectInside(text.getBoundingClientRect(), exported.getBoundingClientRect());
    } finally {
      sheet.remove();
    }
  });
});
