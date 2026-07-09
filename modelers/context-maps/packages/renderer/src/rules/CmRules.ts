/**
 * Allowed editing operations.
 *
 *  - Contexts are free, placed, resizable shapes that overlap but never nest.
 *  - Relationships are connections between two distinct contexts (no
 *    self-loops), at most ONE per pair of contexts — a second, overlapping
 *    line between the same two contexts is impossible to tell apart visually.
 */

import RuleProvider from "diagram-js/lib/features/rules/RuleProvider";
import type EventBus from "diagram-js/lib/core/EventBus";
import { isCmContext } from "../model/di-types.js";

interface MoveContext {
  target?: { parent?: unknown } | null;
}

interface ConnectContext {
  source?: unknown;
  target?: unknown;
}

interface ReconnectContext {
  source?: unknown;
  target?: unknown;
  connection?: unknown;
}

export default class CmRules extends RuleProvider {
  static override $inject = ["eventBus"];

  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  override init(): void {
    // Don't re-parent a dragged shape into whatever it is dropped on: contexts
    // are independent and only overlap. Dropping on the root (no parent) is fine.
    this.addRule(["shape.move", "elements.move"], (context: MoveContext) =>
      context.target && context.target.parent ? null : true,
    );
    this.addRule("shape.create", () => true);
    this.addRule("shape.resize", () => true);

    // A relationship connects two distinct contexts. Returning an attributes
    // object (not just `true`) makes diagram-js stamp the new connection as a
    // relationship with a default pattern, so it renders correctly.
    this.addRule("connection.create", (context: ConnectContext) =>
      canConnect(context.source, context.target),
    );
    this.addRule("connection.reconnect", (context: ReconnectContext) =>
      canConnect(context.source, context.target, context.connection) ? true : false,
    );
    this.addRule("connection.updateWaypoints", () => true);
  }
}

interface ConnectedElement {
  incoming?: Array<{ source?: unknown; target?: unknown }>;
  outgoing?: Array<{ source?: unknown; target?: unknown }>;
}

/** True if any relationship (other than `ignore`) already links the two contexts, either way. */
function alreadyConnected(source: unknown, target: unknown, ignore?: unknown): boolean {
  const { incoming = [], outgoing = [] } = source as ConnectedElement;
  return [...incoming, ...outgoing].some(
    (connection) =>
      connection !== ignore &&
      ((connection.source === source && connection.target === target) ||
        (connection.source === target && connection.target === source)),
  );
}

/** Returns default relationship attributes if the connection is allowed, else false. */
function canConnect(
  source: unknown,
  target: unknown,
  ignore?: unknown,
): false | { cmKind: "relationship"; pattern: "upstream-downstream" } {
  if (!isCmContext(source) || !isCmContext(target)) return false;
  if (source === target) return false;
  if (alreadyConnected(source, target, ignore)) return false;
  return { cmKind: "relationship", pattern: "upstream-downstream" };
}
