/**
 * Marks the canvas container with `cm-dragging` while any drag operation
 * (connect, move, create) is in flight. The CSS keyed on it makes the HTML
 * overlays (connect handles, validation markers, tooltips) click-transparent,
 * so releasing a drag on top of one still reaches the element underneath —
 * otherwise a connect drag dropped on a warning triangle would silently die.
 */

import type EventBus from "diagram-js/lib/core/EventBus";
import type Canvas from "diagram-js/lib/core/Canvas";

const DRAGGING_CLS = "cm-dragging";

export default class CmDragBehavior {
  static $inject = ["eventBus", "canvas"];

  constructor(eventBus: EventBus, canvas: Canvas) {
    eventBus.on("drag.init", () => {
      canvas.getContainer().classList.add(DRAGGING_CLS);
    });
    eventBus.on("drag.cleanup", () => {
      canvas.getContainer().classList.remove(DRAGGING_CLS);
    });
  }
}
