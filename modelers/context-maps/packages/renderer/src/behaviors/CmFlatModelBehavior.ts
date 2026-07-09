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
          modeling.layoutConnection(connection);
        }
      }
    };

    this.postExecute(["shape.move", "elements.move", "shape.resize"], relayout, true);
  }
}
