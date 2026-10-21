import type { Shape } from 'diagram-js/lib/model/Types';
import type { DiagramNode } from '@miragon/__NOTATION__-schema-model';

/**
 * diagram-js elements carry the editable domain truth as flat properties. `elementLabel`, not
 * `label`: diagram-js uses `label` for an element's external label shape.
 */
export interface NodeShape extends Shape {
  elementKind: 'node';
  elementLabel: string;
  /** The imported node, for the fields the canvas does not edit (written back on export). */
  businessObject?: DiagramNode;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isNodeShape(element: unknown): element is NodeShape {
  return isObject(element) && element['elementKind'] === 'node';
}
