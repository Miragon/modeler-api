import type ElementFactory from 'diagram-js/lib/core/ElementFactory';
import { NODE_SIZE, type DiagramNode } from '@miragon/__NOTATION__-schema-model';
import type { NodeShape } from './di-types.js';

/** Builds diagram-js shapes from the model (import) and blank ones for the palette. */
export default class NodeFactory {
  static $inject = ['elementFactory'];

  constructor(private readonly elementFactory: ElementFactory) {}

  fromDocument(node: DiagramNode): NodeShape {
    return this.elementFactory.createShape({
      id: node.id,
      x: node.x,
      y: node.y,
      width: NODE_SIZE.width,
      height: NODE_SIZE.height,
      elementKind: 'node',
      elementLabel: node.label,
      businessObject: node,
    }) as NodeShape;
  }

  /** No id and no position: the element factory allocates the id, the create tool the position. */
  createNew(label = ''): NodeShape {
    return this.elementFactory.createShape({
      width: NODE_SIZE.width,
      height: NODE_SIZE.height,
      elementKind: 'node',
      elementLabel: label,
    }) as NodeShape;
  }
}
