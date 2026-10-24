/**
 * Straight-line connection layouter that crops the waypoints to the context box
 * borders via the cropping docking. diagram-js' stock BaseLayouter only returns
 * mid(source)→mid(target), so without this the relationship line would run from
 * box centre to box centre (visibly starting inside the boxes).
 */

import { getMid } from "diagram-js/lib/layout/LayoutUtil";
import type CroppingConnectionDocking from "diagram-js/lib/layout/CroppingConnectionDocking";
import type { ConnectionLike, ShapeLike } from "diagram-js/lib/model/Types";
import type { Point } from "diagram-js/lib/util/Types";

interface LayoutHints {
  /**
   * diagram-js may pass a Point (drag anchor) or `false` (end did not move,
   * e.g. MoveHelper's `connectionStart: sourceMoved && anchor`) here.
   */
  connectionStart?: Point | false;
  connectionEnd?: Point | false;
  source?: ShapeLike;
  target?: ShapeLike;
}

export default class CmLayouter {
  static $inject = ["connectionDocking"];

  constructor(private readonly docking: CroppingConnectionDocking) {}

  layoutConnection(connection: ConnectionLike, hints: LayoutHints = {}): Point[] {
    const source = hints.source ?? connection.source;
    const target = hints.target ?? connection.target;
    // A relationship line always aims at the CENTRE of its contexts (then gets
    // cropped to the borders below). Anchor hints are deliberately ignored when
    // the shape is known: diagram-js' move helpers pass stale/shifted anchors
    // (the box may already have been relaid out), which would detach the line.
    // Hints only matter while an end has no shape yet (connect rubber band).
    const start = source ? getMid(source) : hints.connectionStart || undefined;
    const end = target ? getMid(target) : hints.connectionEnd || undefined;

    const provisional: Point[] = [start, end].filter(Boolean) as Point[];
    // Give the connection a straight line so the docking can crop it to the
    // shape borders. Falls back to the raw line if either end is missing.
    connection.waypoints = provisional;
    if (source && target && provisional.length === 2) {
      return this.docking.getCroppedWaypoints(connection, source, target);
    }
    return provisional;
  }
}
