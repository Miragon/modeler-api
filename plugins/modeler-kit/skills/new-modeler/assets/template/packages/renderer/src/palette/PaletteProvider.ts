import type Canvas from 'diagram-js/lib/core/Canvas';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type Create from 'diagram-js/lib/features/create/Create';
import type HandTool from 'diagram-js/lib/features/hand-tool/HandTool';
import type LassoTool from 'diagram-js/lib/features/lasso-tool/LassoTool';
import type Modeling from 'diagram-js/lib/features/modeling/Modeling';
import type Palette from 'diagram-js/lib/features/palette/Palette';
import type BasePaletteProvider from 'diagram-js/lib/features/palette/PaletteProvider';
import type Selection from 'diagram-js/lib/features/selection/Selection';
import type { Shape } from 'diagram-js/lib/model/Types';
import type { DiagramPoint, FreeArea, FreeAreaInsets } from '@miragon/modeler-api';
import type { Injector } from 'didi';
import { ICONS, paletteEntryHtml } from '../draw/icons.js';
import { isNodeShape, type NodeShape } from '../model/di-types.js';
import type NodeFactory from '../model/NodeFactory.js';
import type LabelEditing from '../label-editing/LabelEditing.js';

export interface PaletteConfig {
  /**
   * The canvas area the host's chrome leaves free (the contract's `freeArea` option): Enter or
   * Space on a creating entry places the element in its centre (guide §5.5). Without it, the
   * centre of the visible canvas.
   */
  freeArea?: FreeArea | undefined;
}

interface PaletteEntry {
  group: string;
  html: string;
  title: string;
  shortcut?: string;
  action: Record<string, (event: Event) => void>;
}

interface EditLock {
  isReadOnly(): boolean;
}

/** Guide §5.5: a keyboard-created element lands this far down-right of one already centred there. */
const KEYBOARD_CREATE_OFFSET = 24;

/**
 * Tools first (Lasso, Hand: the two a read-only canvas keeps), then the creating entries. Tool
 * keys end in `-tool` in the group `tools`, so the shell marks the armed tool; titles and
 * shortcuts are separate fields, so the chrome tooltip shows the key as a chip.
 */
export default class PaletteProvider {
  static $inject = [
    'palette',
    'create',
    'nodeFactory',
    'handTool',
    'lassoTool',
    'canvas',
    'modeling',
    'selection',
    'elementRegistry',
    'injector',
    'config.palette',
  ];

  constructor(
    palette: Palette,
    private readonly create: Create,
    private readonly factory: NodeFactory,
    private readonly handTool: HandTool,
    private readonly lassoTool: LassoTool,
    private readonly canvas: Canvas,
    private readonly modeling: Modeling,
    private readonly selection: Selection,
    private readonly elementRegistry: ElementRegistry,
    private readonly injector: Injector,
    private readonly config: PaletteConfig | undefined,
  ) {
    palette.registerProvider(this as unknown as BasePaletteProvider);
  }

  getPaletteEntries(): Record<string, PaletteEntry> {
    const createNode = (event: Event) => {
      if (this.injector.get<EditLock>('readOnly', false)?.isReadOnly()) return;
      const shape = this.factory.createNew();
      if (isKeyboardClick(event)) this.placeInFreeArea(shape);
      else this.create.start(event as MouseEvent, shape as Shape);
    };
    return {
      'lasso-tool': {
        group: 'tools',
        title: 'Lasso',
        shortcut: 'L',
        html: paletteEntryHtml(ICONS.lassoTool),
        action: { click: (event) => this.lassoTool.activateSelection(event as MouseEvent, false) },
      },
      'hand-tool': {
        group: 'tools',
        title: 'Hand',
        shortcut: 'H',
        html: paletteEntryHtml(ICONS.handTool),
        action: { click: (event) => this.handTool.activateHand(event as MouseEvent, false, false) },
      },
      'create.node': {
        group: 'elements',
        title: 'Node',
        html: paletteEntryHtml(ICONS.createNode, true),
        action: { click: createNode, dragstart: createNode },
      },
    };
  }

  /**
   * Enter or Space on a creating entry (the shell's synthetic click, detail 0): diagram-js's create
   * tool follows the pointer and never ends without one, so the element goes straight to the
   * centre of the free area, selected, with the focus on the canvas and its label editor open.
   */
  private placeInFreeArea(shape: NodeShape): void {
    const centre = this.freeAreaCentre() ?? this.visibleCentre();
    const position = { x: centre.x, y: centre.y };
    while (this.centreTaken(position)) {
      position.x += KEYBOARD_CREATE_OFFSET;
      position.y += KEYBOARD_CREATE_OFFSET;
    }
    const created = this.modeling.createShape(
      shape as Shape,
      position,
      this.canvas.getRootElement() as Shape,
    ) as NodeShape;
    this.selection.select(created);
    this.canvas.focus();
    this.injector.get<LabelEditing>('labelEditing', false)?.activate(created);
  }

  private freeAreaCentre(): DiagramPoint | undefined {
    const area = this.config?.freeArea;
    if (area?.center) return area.center();
    if (area?.insets) return this.centreWithin(area.insets());
    return undefined;
  }

  /** The centre of the container without the insets, in diagram coordinates, as a fit centres. */
  private centreWithin(insets: FreeAreaInsets): DiagramPoint | undefined {
    const { width, height } = this.canvas.getSize();
    if (!(width > 0 && height > 0)) return undefined;
    const middle = (size: number, start: number, end: number): number =>
      start + end < size ? start + (size - start - end) / 2 : size / 2;
    const { x, y, scale } = this.canvas.viewbox();
    return {
      x: x + middle(width, insets.left, insets.right) / scale,
      y: y + middle(height, insets.top, insets.bottom) / scale,
    };
  }

  private visibleCentre(): DiagramPoint {
    const { x, y, width, height } = this.canvas.viewbox();
    return { x: x + width / 2, y: y + height / 2 };
  }

  private centreTaken(point: DiagramPoint): boolean {
    return (this.elementRegistry.filter(isNodeShape) as NodeShape[]).some(
      (element) =>
        Math.abs(element.x + element.width / 2 - point.x) < 1 &&
        Math.abs(element.y + element.height / 2 - point.y) < 1,
    );
  }
}

/** The click the shell synthesises for Enter or Space on an entry: no pointer, detail 0. */
function isKeyboardClick(event: Event): boolean {
  return event.type === 'click' && (event as MouseEvent).detail === 0;
}
