/**
 * Clicking an already-selected element KEEPS it selected. diagram-js' stock
 * SelectionBehavior toggles instead (click on selected = deselect), which
 * reads as "the editor lost my selection" — especially since the connect
 * handles and the inspector vanish with it. Deselecting is done by clicking
 * the empty canvas. Ctrl/Cmd-click still toggles for multi-select workflows.
 */

import type EventBus from "diagram-js/lib/core/EventBus";
import type Selection from "diagram-js/lib/features/selection/Selection";
import { hasPrimaryModifier } from "diagram-js/lib/util/Mouse";
import { isCmElement } from "../model/di-types.js";

/** Above SelectionBehavior's element.click listener (default priority 500). */
const BEFORE_SELECTION_BEHAVIOR = 2000;

export default class CmClickSelectionBehavior {
  static $inject = ["eventBus", "selection"];

  constructor(eventBus: EventBus, selection: Selection) {
    eventBus.on(
      "element.click",
      BEFORE_SELECTION_BEHAVIOR,
      (event: { element?: unknown } & Parameters<typeof hasPrimaryModifier>[0]) => {
        const element = event.element;
        if (!isCmElement(element)) return;
        if (hasPrimaryModifier(event)) return;
        if (selection.isSelected(element)) return false;
      },
    );
  }
}
