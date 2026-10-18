import Diagram from "diagram-js";
import type ElementFactory from "diagram-js/lib/core/ElementFactory";
import type ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import type Canvas from "diagram-js/lib/core/Canvas";
import CreateModule from "diagram-js/lib/features/create";
import type Create from "diagram-js/lib/features/create/Create";
import EditorActionsModule from "diagram-js/lib/features/editor-actions";
import HandToolModule from "diagram-js/lib/features/hand-tool";
import type HandTool from "diagram-js/lib/features/hand-tool/HandTool";
import KeyboardModule from "diagram-js/lib/features/keyboard";
import LassoToolModule from "diagram-js/lib/features/lasso-tool";
import type LassoTool from "diagram-js/lib/features/lasso-tool/LassoTool";
import ModelingModule from "diagram-js/lib/features/modeling";
import type Modeling from "diagram-js/lib/features/modeling/Modeling";
import MoveModule from "diagram-js/lib/features/move";
import OutlineModule from "diagram-js/lib/features/outline";
import PaletteModule from "diagram-js/lib/features/palette";
import type Palette from "diagram-js/lib/features/palette/Palette";
import type { PaletteEntries } from "diagram-js/lib/features/palette/PaletteProvider";
import SelectionModule from "diagram-js/lib/features/selection";
import MoveCanvasModule from "diagram-js/lib/navigation/movecanvas";
import ZoomScrollModule from "diagram-js/lib/navigation/zoomscroll";
import type { Parent } from "diagram-js/lib/model/Types";
import type { ModuleDeclaration } from "didi";

import { PALETTE_TOOL_ICON, iconMarkup, type Bounds } from "../src/index.js";
import { shellModule } from "../src/diagram-js.js";

class DemoPaletteProvider {
  static $inject = ["palette", "create", "elementFactory", "lassoTool", "handTool"];

  constructor(
    palette: Palette,
    private readonly create: Create,
    private readonly elementFactory: ElementFactory,
    private readonly lassoTool: LassoTool,
    private readonly handTool: HandTool,
  ) {
    palette.registerProvider(this);
  }

  getPaletteEntries(): PaletteEntries {
    const startCreate = (width: number, height: number) => (event: Event) =>
      this.create.start(event, this.elementFactory.createShape({ width, height }));
    return {
      "lasso-tool": {
        group: "tools",
        title: "Lasso",
        shortcut: "L",
        html: `<div class="entry">${iconMarkup("square-dashed-mouse-pointer", PALETTE_TOOL_ICON)}</div>`,
        action: { click: (event: Event) => this.lassoTool.activateSelection(event as MouseEvent) },
      },
      "hand-tool": {
        group: "tools",
        title: "Hand",
        shortcut: "H",
        html: `<div class="entry">${iconMarkup("hand", PALETTE_TOOL_ICON)}</div>`,
        action: { click: (event: Event) => this.handTool.activateHand(event) },
      },
      "create.box": {
        group: "shapes",
        title: "Box",
        className: "demo-entry-box",
        action: { dragstart: startCreate(120, 80), click: startCreate(120, 80) },
      },
      "create.wide-box": {
        group: "shapes",
        title: "Wide box",
        className: "demo-entry-wide-box",
        action: { dragstart: startCreate(200, 80), click: startCreate(200, 80) },
      },
    };
  }
}

const demoPaletteModule: ModuleDeclaration = {
  __init__: ["demoPaletteProvider"],
  demoPaletteProvider: ["type", DemoPaletteProvider],
};

/** A minimal diagram-js modeler with palette, built before the shell is mounted. */
export function createDemoDiagram(container: HTMLElement): Diagram {
  return new Diagram({
    canvas: { container },
    modules: [
      SelectionModule,
      ZoomScrollModule,
      MoveCanvasModule,
      KeyboardModule,
      EditorActionsModule,
      ModelingModule,
      CreateModule,
      MoveModule,
      OutlineModule,
      LassoToolModule,
      HandToolModule,
      PaletteModule,
      demoPaletteModule,
      shellModule,
    ],
  });
}

/** Adds a few boxes, standing in for an import. */
export function addSampleShapes(diagram: Diagram): void {
  const canvas = diagram.get<Canvas>("canvas");
  const modeling = diagram.get<Modeling>("modeling");
  const elementFactory = diagram.get<ElementFactory>("elementFactory");
  const root = canvas.getRootElement() as Parent;
  for (const [x, y] of [
    [100, 100],
    [400, 160],
    [700, 320],
  ] as const) {
    modeling.createShape(elementFactory.createShape({ width: 160, height: 100 }), { x, y }, root);
  }
}

/** Bounds of every shape; `undefined` for an empty diagram. */
export function demoContentBounds(diagram: Diagram): Bounds | undefined {
  const shapes = diagram
    .get<ElementRegistry>("elementRegistry")
    .getAll()
    .filter(
      (element): element is typeof element & Bounds =>
        "parent" in element && Boolean(element.parent) && !("waypoints" in element),
    );
  if (shapes.length === 0) return undefined;
  const left = Math.min(...shapes.map((shape) => shape.x));
  const top = Math.min(...shapes.map((shape) => shape.y));
  const right = Math.max(...shapes.map((shape) => shape.x + shape.width));
  const bottom = Math.max(...shapes.map((shape) => shape.y + shape.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}
