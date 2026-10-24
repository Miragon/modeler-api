/**
 * Two model-keeping behaviours:
 *
 *  1. Flat model — diagram-js parents a newly created shape to whatever element
 *     it is dropped on, which would nest overlapping contexts and glue them
 *     together. Force every created shape onto the diagram root instead.
 *     (Re-parenting on *move* is prevented separately in CmRules.)
 *
 *  2. Connection relayout — when a context moves or resizes, re-crop the
 *     waypoints of its attached relationships to the new box borders, so lines
 *     stay docked to the edges.
 */

import CommandInterceptor from "diagram-js/lib/command/CommandInterceptor";
import type EventBus from "diagram-js/lib/core/EventBus";
import type Canvas from "diagram-js/lib/core/Canvas";
import type Modeling from "diagram-js/lib/features/modeling/Modeling";
import type { Connection, Shape } from "diagram-js/lib/model/Types";

interface MovedContext {
  shape?: Shape;
  shapes?: Shape[];
}

export default class CmFlatModelBehavior extends CommandInterceptor {
  static override $inject = ["eventBus", "canvas", "modeling"];

  constructor(eventBus: EventBus, canvas: Canvas, modeling: Modeling) {
    super(eventBus);

    this.preExecute(
      ["shape.create", "elements.create"],
      (context: { parent?: unknown }) => {
        context.parent = canvas.getRootElement();
      },
      true,
    );

    // During a multi-element move, diagram-js' MoveHelper translates every
    // fully-enclosed connection (both ends moved) by the drag delta AFTER the
    // per-shape child commands ran. Re-cropping those connections here as well
    // would apply the delta twice — and a straight line whose two ends move by
    // the same delta is already correct after the plain translation. Track the
    // moved set so relayout only touches half-attached connections.
    let multiMove: Set<string> | null = null;
    this.preExecute(
      "elements.move",
      (context: MovedContext) => {
        multiMove = new Set((context.shapes ?? []).map((shape) => shape.id));
      },
      true,
    );
    this.postExecuted(
      "elements.move",
      () => {
        multiMove = null;
      },
      true,
    );

    const relayout = (context: MovedContext): void => {
      const shapes = context.shapes ?? (context.shape ? [context.shape] : []);
      const seen = new Set<string>();
      for (const shape of shapes) {
        const attached: Connection[] = [
          ...((shape.incoming as Connection[]) ?? []),
          ...((shape.outgoing as Connection[]) ?? []),
        ];
        for (const connection of attached) {
          if (seen.has(connection.id)) continue;
          seen.add(connection.id);
          const sourceId = connection.source?.id;
          const targetId = connection.target?.id;
          if (sourceId && targetId && multiMove?.has(sourceId) && multiMove.has(targetId)) {
            continue;
          }
          modeling.layoutConnection(connection);
        }
      }
    };

    this.postExecute(["shape.move", "shape.resize"], relayout, true);
  }
}
