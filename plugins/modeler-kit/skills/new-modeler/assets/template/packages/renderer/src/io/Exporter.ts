import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import {
  validateDocument,
  type DiagramDocument,
  type DiagramNode,
} from '@miragon/__NOTATION__-schema-model';
import { isNodeShape, type NodeShape } from '../model/di-types.js';
import { ROOT_ID, type RootBusinessObject } from './types.js';

/**
 * Rebuilds the document from the live canvas: the shapes' flat properties are the truth, the
 * imported business object backfills what the canvas does not edit (foreign fields, L6).
 */
export default class Exporter {
  static $inject = ['elementRegistry'];

  constructor(private readonly elementRegistry: ElementRegistry) {}

  export(): DiagramDocument {
    const shapes = this.elementRegistry.filter(isNodeShape) as NodeShape[];
    const nodes: DiagramNode[] = shapes.map((shape) => ({
      ...shape.businessObject,
      id: shape.id,
      label: shape.elementLabel,
      x: shape.x,
      y: shape.y,
    }));
    // Read without canvas.getRootElement(), which would create an implicit root before an import.
    const root = this.elementRegistry.get(ROOT_ID) as
      { businessObject?: RootBusinessObject } | undefined;
    const data = root?.businessObject;
    return validateDocument({
      ...data?.extensions,
      ...(data?.title === undefined ? {} : { title: data.title }),
      nodes,
      passthrough: data?.passthrough ?? [],
    });
  }
}
