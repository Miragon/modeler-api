/**
 * Four connect handles around a selected bounded context — one arrow at the
 * middle of each side (top, right, bottom, left), each pointing outward.
 * Press a handle, drag, release over another context to draw the relationship
 * (press-drag-release ONLY: a click listener would restart the tool after the
 * mouseup and leave the preview line chasing the cursor). Implemented as
 * diagram-js overlays so the handles float outside the shape, follow it, and
 * never collide with the resize handles on the selection outline.
 */

import type EventBus from "diagram-js/lib/core/EventBus";
import type Overlays from "diagram-js/lib/features/overlays/Overlays";
import type Selection from "diagram-js/lib/features/selection/Selection";
import type Connect from "diagram-js/lib/features/connect/Connect";
import type Dragging from "diagram-js/lib/features/dragging/Dragging";
import type { Element } from "diagram-js/lib/model/Types";
import { getMid } from "diagram-js/lib/layout/LayoutUtil";
import { isCmContext } from "../model/di-types.js";
import { ICON_ARROW_FORWARD, iconMarkup } from "../draw/icons.js";

const OVERLAY_TYPE = "cm-connect-handle";
const HANDLE_SIZE = 28;
/** Clear of the selection outline and its mid-side resize handles. */
const HANDLE_GAP = 12;

const SIDES = [
  { side: "top", rotationDeg: -90 },
  { side: "right", rotationDeg: 0 },
  { side: "bottom", rotationDeg: 90 },
  { side: "left", rotationDeg: 180 },
] as const;

type Side = (typeof SIDES)[number]["side"];

function handlePosition(
  side: Side,
  shape: { width: number; height: number },
): { top: number; left: number } {
  const centeredLeft = shape.width / 2 - HANDLE_SIZE / 2;
  const centeredTop = shape.height / 2 - HANDLE_SIZE / 2;
  const outside = HANDLE_SIZE + HANDLE_GAP;
  switch (side) {
    case "top":
      return { top: -outside, left: centeredLeft };
    case "bottom":
      return { top: shape.height + HANDLE_GAP, left: centeredLeft };
    case "left":
      return { top: centeredTop, left: -outside };
    case "right":
      return { top: centeredTop, left: shape.width + HANDLE_GAP };
  }
}

export default class CmConnectHandles {
  static $inject = ["eventBus", "selection", "overlays", "connect", "dragging"];

  constructor(
    private readonly eventBus: EventBus,
    private readonly selection: Selection,
    private readonly overlays: Overlays,
    connect: Connect,
    private readonly dragging: Dragging,
  ) {
    // Not used to start the drag, but injecting Connect instantiates it so its
    // connect.* event handlers (hover/end → modeling.connect) are registered —
    // the connect module does not eagerly initialize it.
    void connect;
    const refresh = (): void => this.refresh();
    eventBus.on("selection.changed", refresh);
    // Re-anchor after resize/undo/redo (handle offsets depend on width/height).
    eventBus.on("commandStack.changed", refresh);
  }

  private refresh(): void {
    this.overlays.remove({ type: OVERLAY_TYPE });

    const selected = this.selection.get() as Element[];
    if (selected.length !== 1) return;
    const element = selected[0];
    if (!isCmContext(element)) return;
    const shape = element as unknown as { width: number; height: number };

    for (const { side, rotationDeg } of SIDES) {
      const handle = document.createElement("div");
      handle.className = "cm-connect-handle";
      handle.dataset.side = side;
      handle.title = "Connect to another context";
      handle.innerHTML = `<span style="display:flex;transform:rotate(${rotationDeg}deg)">${iconMarkup(ICON_ARROW_FORWARD)}</span>`;
      handle.addEventListener("mousedown", (event: MouseEvent) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        // Same payload as Connect#start, but with trapClick OFF: the ghost-
        // click trap Dragging arms after a drag is only consumed by a click
        // that reaches the canvas — a drag started on this HTML handle never
        // produces one, so the trap would instead swallow the user's NEXT
        // click on a context (no selection, seemingly broken editor).
        this.dragging.init(event, "connect", {
          autoActivate: false,
          trapClick: false,
          data: {
            shape: element,
            context: { start: element, connectionStart: getMid(element) },
          },
        });
        // Keep the source context marked after the drag: the drag lifecycle
        // clears the selection, but the user is still "at" this context. Low
        // priority so this runs after the stock cleanup listeners.
        this.eventBus.once("connect.cleanup", 250, () => {
          if (this.selection.get().length === 0) this.selection.select(element);
        });
      });

      this.overlays.add(element, OVERLAY_TYPE, {
        position: handlePosition(side, shape),
        html: handle,
      });
    }
  }
}
