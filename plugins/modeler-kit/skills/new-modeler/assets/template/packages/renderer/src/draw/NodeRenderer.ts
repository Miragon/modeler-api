import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer';
import TextUtil, { type TextLayoutConfig } from 'diagram-js/lib/util/Text';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type { Element, Shape } from 'diagram-js/lib/model/Types';
import { append as svgAppend, attr as svgAttr, create as svgCreate } from 'tiny-svg';
import { isNodeShape, type NodeShape } from '../model/di-types.js';
import { COLORS, CORNER_RADIUS, FONT, LABEL_PADDING, STROKE_WIDTH } from './styles.js';

/** Above diagram-js's default renderer (1000). */
const RENDER_PRIORITY = 1500;

const ELLIPSIS = '…';
const LINE_HEIGHT = FONT.size * FONT.lineHeight;

export default class NodeRenderer extends BaseRenderer {
  static $inject = ['eventBus'];

  private readonly textUtil = new TextUtil({
    style: { fontFamily: FONT.family, fontSize: FONT.size, lineHeight: FONT.lineHeight },
  });

  constructor(eventBus: EventBus) {
    super(eventBus, RENDER_PRIORITY);
  }

  override canRender(element: Element): boolean {
    return isNodeShape(element);
  }

  override drawShape(visuals: SVGElement, element: Shape): SVGElement {
    const shape = element as NodeShape;
    const rect = svgCreate('rect');
    svgAttr(rect, {
      width: shape.width,
      height: shape.height,
      rx: CORNER_RADIUS,
      fill: COLORS.fill,
      stroke: COLORS.ink,
      'stroke-width': STROKE_WIDTH,
    });
    svgAppend(visuals, rect);
    if (shape.elementLabel) svgAppend(visuals, this.createLabel(shape.elementLabel, shape));
    return rect;
  }

  /**
   * The label inside its node: lines that would run past the node are dropped and the last kept
   * one ends in an ellipsis. Nothing is drawn outside the node, so the content bounds (the nodes'
   * boxes) cover the drawing, and neither the fit nor an export cuts a line off.
   */
  private createLabel(text: string, shape: NodeShape): SVGElement {
    const options: TextLayoutConfig = {
      box: { width: shape.width, height: shape.height },
      align: 'center-middle',
      padding: LABEL_PADDING,
      style: { fill: COLORS.ink },
    };
    const label = this.textUtil.createText(text, options);
    const lines = [...label.children].map((line) => line.textContent ?? '');
    const maxLines = Math.max(1, Math.floor((shape.height - 2 * LABEL_PADDING) / LINE_HEIGHT));
    if (lines.length <= maxLines) return label;
    const kept = lines.slice(0, maxLines - 1);
    let last = (lines[maxLines - 1] ?? '').trimEnd();
    for (;;) {
      const cut = this.textUtil.createText([...kept, `${last}${ELLIPSIS}`].join('\n'), options);
      if (cut.children.length <= maxLines || last === '') return cut;
      last = last.slice(0, -1).trimEnd();
    }
  }

  override getShapePath(shape: Shape): string {
    const { x, y, width, height } = shape;
    return `M${x},${y}h${width}v${height}h${-width}z`;
  }
}
