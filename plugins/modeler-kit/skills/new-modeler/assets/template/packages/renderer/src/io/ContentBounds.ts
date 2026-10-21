import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type { Element } from 'diagram-js/lib/model/Types';
import { getBBox } from 'diagram-js/lib/util/Elements';
import { isNodeShape } from '../model/di-types.js';
import type { Bounds } from './types.js';

/** The extent of the content: one source for the import's fit, the SVG export and a host's fit. */
export default class ContentBounds {
  static $inject = ['elementRegistry'];

  constructor(private readonly elementRegistry: ElementRegistry) {}

  isEmpty(): boolean {
    return !this.elementRegistry.getAll().some(isNodeShape);
  }

  /** The tight bounds grown by `padding` on every side; undefined while the canvas is empty. */
  contentBounds(padding = 0): Bounds | undefined {
    const elements = this.elementRegistry.filter(isNodeShape) as Element[];
    if (elements.length === 0) return undefined;
    const { x, y, width, height } = getBBox(elements);
    return {
      x: x - padding,
      y: y - padding,
      width: width + 2 * padding,
      height: height + 2 * padding,
    };
  }
}
