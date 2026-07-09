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
  connectionStart?: Point;
  connectionEnd?: Point;
  source?: ShapeLike;
  target?: ShapeLike;
}

export default class CmLayouter {
  static $inject = ["connectionDocking"];

  constructor(private readonly docking: CroppingConnectionDocking) {}

  layoutConnection(connection: ConnectionLike, hints: LayoutHints = {}): Point[] {
    const source = hints.source ?? connection.source;
    const target = hints.target ?? connection.target;
    const start = hints.connectionStart ?? (source ? getMid(source) : undefined);
    const end = hints.connectionEnd ?? (target ? getMid(target) : undefined);

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
