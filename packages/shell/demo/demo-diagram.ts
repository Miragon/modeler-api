import Diagram from "diagram-js";
import type ElementFactory from "diagram-js/lib/core/ElementFactory";
import type ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import type Canvas from "diagram-js/lib/core/Canvas";
import type EventBus from "diagram-js/lib/core/EventBus";
import ContextPadModule from "diagram-js/lib/features/context-pad";
import type ContextPad from "diagram-js/lib/features/context-pad/ContextPad";
import type { ContextPadEntries } from "diagram-js/lib/features/context-pad/ContextPadProvider";
import CreateModule from "diagram-js/lib/features/create";
import type Create from "diagram-js/lib/features/create/Create";
import EditorActionsModule from "diagram-js/lib/features/editor-actions";
import HandToolModule from "diagram-js/lib/features/hand-tool";
import type HandTool from "diagram-js/lib/features/hand-tool/HandTool";
import KeyboardModule from "diagram-js/lib/features/keyboard";
import type Keyboard from "diagram-js/lib/features/keyboard/Keyboard";
import { isCmd, isKey } from "diagram-js/lib/features/keyboard/KeyboardUtil";
import LassoToolModule from "diagram-js/lib/features/lasso-tool";
import type LassoTool from "diagram-js/lib/features/lasso-tool/LassoTool";
import ModelingModule from "diagram-js/lib/features/modeling";
import type Modeling from "diagram-js/lib/features/modeling/Modeling";
import MoveModule from "diagram-js/lib/features/move";
import OutlineModule from "diagram-js/lib/features/outline";
import PaletteModule from "diagram-js/lib/features/palette";
import type Palette from "diagram-js/lib/features/palette/Palette";
import type { PaletteEntries } from "diagram-js/lib/features/palette/PaletteProvider";
import RuleProvider from "diagram-js/lib/features/rules/RuleProvider";
import type Rules from "diagram-js/lib/features/rules/Rules";
import SelectionModule from "diagram-js/lib/features/selection";
import type Selection from "diagram-js/lib/features/selection/Selection";
import MoveCanvasModule from "diagram-js/lib/navigation/movecanvas";
import ZoomScrollModule from "diagram-js/lib/navigation/zoomscroll";
import type { Element, Parent, Shape } from "diagram-js/lib/model/Types";
import type { ModuleDeclaration } from "didi";

import { PALETTE_TOOL_ICON, iconMarkup, type Bounds, type Point } from "../src/index.js";
import { shellModule } from "../src/diagram-js.js";

/**
 * Faults the kit's saboteur specs switch on at runtime (`window.__demo.flaws`), each breaking one
 * rule a conformance case must catch.
 */
export interface DemoFlaws {
  /** Enter or Space on a creating palette entry adds nothing (case `create`). */
  noKeyboardCreate: boolean;
  /** The read-only lock leaves the canvas editable: context pad, move, delete (case `readOnly`). */
  canvasUnlocked: boolean;
  /** Cmd/Ctrl+A on the canvas does nothing, so VS Code runs its own Select All (case `keys`). */
  noSelectAll: boolean;
}

/** What the demo modeler reads from the page around it, at the moment it needs it. */
export interface DemoHooks {
  readonly flaws: DemoFlaws;
  /** `shell.isReadOnly()`. */
  isReadOnly(): boolean;
  /** `viewport.freeRectCenter()`. */
  freeRectCenter(): Point | undefined;
}

/** Guide §5.5: a keyboard-created element moves 24px diagonally off an element already centred there. */
const KEYBOARD_CREATE_OFFSET = 24;
const KEYBOARD_CREATE_ATTEMPTS = 20;

function isCanvasLocked(hooks: DemoHooks): boolean {
  return hooks.isReadOnly() && !hooks.flaws.canvasUnlocked;
}

class DemoPaletteProvider {
  static $inject = [
    "palette",
    "create",
    "elementFactory",
    "lassoTool",
    "handTool",
    "modeling",
    "rules",
    "selection",
    "canvas",
    "elementRegistry",
    "demoHooks",
  ];

  constructor(
    palette: Palette,
    private readonly create: Create,
    private readonly elementFactory: ElementFactory,
    private readonly lassoTool: LassoTool,
    private readonly handTool: HandTool,
    private readonly modeling: Modeling,
    private readonly rules: Rules,
    private readonly selection: Selection,
    private readonly canvas: Canvas,
    private readonly elementRegistry: ElementRegistry,
    private readonly hooks: DemoHooks,
  ) {
    palette.registerProvider(this);
  }

  getPaletteEntries(): PaletteEntries {
    const startCreate = (width: number, height: number) => (event: Event) =>
      this.create.start(event, this.elementFactory.createShape({ width, height }));
    // The shell activates an entry from the keyboard with a synthetic click: `detail` is 0.
    const clickCreate = (width: number, height: number) => (event: Event) => {
      if ((event as MouseEvent).detail === 0) this.createAtFreeRectCenter(width, height);
      else startCreate(width, height)(event);
    };
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
        action: { dragstart: startCreate(120, 80), click: clickCreate(120, 80) },
      },
      "create.wide-box": {
        group: "shapes",
        title: "Wide box",
        className: "demo-entry-wide-box",
        action: { dragstart: startCreate(200, 80), click: clickCreate(200, 80) },
      },
    };
  }

  /** Guide §5.5: in the centre of the free rectangle, selected, with the focus on the canvas. */
  private createAtFreeRectCenter(width: number, height: number): void {
    if (this.hooks.flaws.noKeyboardCreate) return;
    const centre = this.hooks.freeRectCenter();
    if (!centre) return;
    const root = this.canvas.getRootElement() as Parent;
    const shape = this.elementFactory.createShape({ width, height });
    const position = this.freePosition(centre);
    if (this.rules.allowed("shape.create", { shape, position, target: root }) === false) return;
    this.modeling.createShape(shape, position, root);
    this.selection.select(shape);
    this.canvas.focus();
  }

  private freePosition(centre: Point): Point {
    const centres = this.elementRegistry
      .filter((element): element is Shape => "parent" in element && Boolean(element.parent))
      .filter((shape) => !("waypoints" in shape))
      .map((shape) => ({ x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 }));
    let position = centre;
    for (let attempt = 0; attempt < KEYBOARD_CREATE_ATTEMPTS; attempt++) {
      const occupied = centres.some(
        (other) => Math.abs(other.x - position.x) < 1 && Math.abs(other.y - position.y) < 1,
      );
      if (!occupied) break;
      position = { x: position.x + KEYBOARD_CREATE_OFFSET, y: position.y + KEYBOARD_CREATE_OFFSET };
    }
    return position;
  }
}

/** Guide §13.5: a read-only canvas creates, moves, resizes and deletes nothing. */
class DemoRules extends RuleProvider {
  static override $inject = ["eventBus", "demoHooks"];

  constructor(
    eventBus: EventBus,
    private readonly hooks: DemoHooks,
  ) {
    super(eventBus);
  }

  override init(): void {
    this.addRule(
      ["shape.create", "elements.create", "elements.move", "shape.move"],
      (context: { target?: Element | null }) =>
        !isCanvasLocked(this.hooks) && (!context.target || !context.target.parent),
    );
    this.addRule(["shape.resize", "elements.delete"], () => !isCanvasLocked(this.hooks));
  }
}

/** One Delete entry; a locked canvas opens no context pad at all (guide §13.5). */
class DemoContextPadProvider {
  static $inject = ["contextPad", "modeling", "rules", "eventBus", "demoHooks"];

  constructor(
    contextPad: ContextPad,
    private readonly modeling: Modeling,
    private readonly rules: Rules,
    eventBus: EventBus,
    private readonly hooks: DemoHooks,
  ) {
    contextPad.registerProvider(this);
    eventBus.on("contextPad.open.allowed", () => (isCanvasLocked(this.hooks) ? false : undefined));
  }

  getContextPadEntries(element: Element): ContextPadEntries {
    return this.deleteEntry([element]);
  }

  getMultiElementContextPadEntries(elements: Element[]): ContextPadEntries {
    return this.deleteEntry(elements);
  }

  private deleteEntry(elements: Element[]): ContextPadEntries {
    return {
      delete: {
        group: "edit",
        title: "Delete",
        html: `<div class="entry">${iconMarkup("x")}</div>`,
        action: {
          click: () => {
            if (this.rules.allowed("elements.delete", { elements }) === false) return;
            this.modeling.removeElements([...elements]);
          },
        },
      },
    };
  }
}

/** diagram-js 15 binds no select all; the canvas takes Cmd/Ctrl+A so the host never sees it. */
class DemoSelectAll {
  static $inject = ["keyboard", "selection", "elementRegistry", "canvas", "demoHooks"];

  constructor(
    keyboard: Keyboard,
    selection: Selection,
    elementRegistry: ElementRegistry,
    canvas: Canvas,
    hooks: DemoHooks,
  ) {
    keyboard.addListener((context: { keyEvent: KeyboardEvent }) => {
      const event = context.keyEvent;
      if (hooks.flaws.noSelectAll || event.shiftKey || !isCmd(event) || !isKey(["a", "A"], event)) return;
      const root = canvas.getRootElement();
      selection.select(elementRegistry.filter((element) => element !== root));
      return true;
    });
  }
}

/** A minimal diagram-js modeler with palette, built before the shell is mounted. */
export function createDemoDiagram(container: HTMLElement, hooks: DemoHooks): Diagram {
  const demoModule: ModuleDeclaration = {
    __init__: ["demoPaletteProvider", "demoRules", "demoContextPadProvider", "demoSelectAll"],
    demoHooks: ["value", hooks],
    demoPaletteProvider: ["type", DemoPaletteProvider],
    demoRules: ["type", DemoRules],
    demoContextPadProvider: ["type", DemoContextPadProvider],
    demoSelectAll: ["type", DemoSelectAll],
  };
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
      ContextPadModule,
      demoModule,
      shellModule,
    ],
  });
}

/** Adds a few boxes, standing in for an import: inside the import events a renderer fires. */
export function addSampleShapes(diagram: Diagram): void {
  const canvas = diagram.get<Canvas>("canvas");
  const modeling = diagram.get<Modeling>("modeling");
  const elementFactory = diagram.get<ElementFactory>("elementFactory");
  const eventBus = diagram.get<EventBus>("eventBus");
  const root = canvas.getRootElement() as Parent;
  eventBus.fire("import.render.start", {});
  for (const [x, y] of [
    [100, 100],
    [400, 160],
    [700, 320],
  ] as const) {
    modeling.createShape(elementFactory.createShape({ width: 160, height: 100 }), { x, y }, root);
  }
  eventBus.fire("import.done", { warnings: [] });
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
