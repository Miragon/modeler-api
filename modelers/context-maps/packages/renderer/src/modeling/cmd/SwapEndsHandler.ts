/**
 * Swaps a relationship's two ends: source ⇄ target (and reverses the waypoints).
 * This flips the direction — what was upstream/supplier becomes downstream/
 * customer and vice versa. Undoable (revert simply swaps back).
 */

import type CommandHandler from "diagram-js/lib/command/CommandHandler";
import type { Connection, Element } from "diagram-js/lib/model/Types";
import type { Point } from "diagram-js/lib/util/Types";

export interface SwapEndsContext {
  connection: Connection & { source: Element; target: Element; waypoints: Point[] };
}

function swap(connection: SwapEndsContext["connection"]): Element[] {
  const oldSource = connection.source;
  connection.source = connection.target;
  connection.target = oldSource;
  if (Array.isArray(connection.waypoints)) {
    connection.waypoints = [...connection.waypoints].reverse();
  }
  return [connection];
}

export default class SwapEndsHandler implements CommandHandler {
  execute(context: SwapEndsContext): Element[] {
    return swap(context.connection);
  }

  revert(context: SwapEndsContext): Element[] {
    return swap(context.connection);
  }
}
