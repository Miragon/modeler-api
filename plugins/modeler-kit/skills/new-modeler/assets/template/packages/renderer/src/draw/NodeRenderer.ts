import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer';
import TextUtil from 'diagram-js/lib/util/Text';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type { Element, Shape } from 'diagram-js/lib/model/Types';
import { append as svgAppend, attr as svgAttr, create as svgCreate } from 'tiny-svg';
import { isNodeShape, type NodeShape } from '../model/di-types.js';
import { COLORS, CORNER_RADIUS, FONT, LABEL_PADDING, STROKE_WIDTH } from './styles.js';

/** Above diagram-js's default renderer (1000). */
const RENDER_PRIORITY = 1500;

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
    if (shape.elementLabel) {
      const label = this.textUtil.createText(shape.elementLabel, {
        box: { width: shape.width, height: shape.height },
        align: 'center-middle',
        padding: LABEL_PADDING,
        style: { fill: COLORS.ink },
      });
      svgAppend(visuals, label);
    }
    return rect;
  }

  override getShapePath(shape: Shape): string {
    const { x, y, width, height } = shape;
    return `M${x},${y}h${width}v${height}h${-width}z`;
  }
}
