/**
 * Keeps the context pad inside the free area: the canvas container minus the `freeArea.insets` a
 * host passes (contract option of `@miragon/modeler-api` 1.2), the whole container without them.
 * diagram-js puts the pad right of its element, top-aligned, and never looks at the edges, so for
 * a shape in the bottom right corner the vertical pad would run under the host's bottom chrome or
 * out of the container. Here a pad that would pass the right edge flips to the left of its
 * element, one that would pass the bottom moves up and one above the top moves down; where the
 * free area is too small, its top left corner wins, so the first entries stay reachable.
 */

import type Canvas from "diagram-js/lib/core/Canvas";
import type EventBus from "diagram-js/lib/core/EventBus";
import type Scheduler from "diagram-js/lib/features/scheduler/Scheduler";
import type { Element } from "diagram-js/lib/model/Types";
import type { FreeArea, FreeAreaInsets } from "@miragon/modeler-api";

/** diagram-js's `CONTEXT_PAD_MARGIN`: the gap between an element and its pad at 100 %. */
const PAD_GAP = 8;
const NO_INSETS: FreeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const PLACEMENT_TASK = "ttContextPad#keepInsideFreeArea";
/** Below diagram-js's own listeners, so this task is scheduled after the one that places the pad. */
const AFTER_DIAGRAM_JS = 250;

export interface TtContextPadConfig {
  /**
   * The part of the canvas no host chrome covers. Only `insets` name a rectangle; with `center`
   * alone, or without the option, the pad keeps inside the whole container.
   */
  freeArea?: FreeArea | undefined;
}

interface OpenPad {
  target: Element | Element[];
  html: HTMLElement;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function isConnection(target: Element | Element[]): boolean {
  return !Array.isArray(target) && "waypoints" in target;
}

export default class TtContextPadPlacement {
  static $inject = ["config.ttContextPad", "eventBus", "canvas", "scheduler"];

  private openPad: OpenPad | undefined;

  constructor(
    private readonly config: TtContextPadConfig | undefined,
    eventBus: EventBus,
    private readonly canvas: Canvas,
    private readonly scheduler: Scheduler,
  ) {
    eventBus.on("contextPad.open", AFTER_DIAGRAM_JS, (event: { current: OpenPad }) => {
      this.openPad = event.current;
      this.schedulePlacement();
    });
    eventBus.on(["contextPad.show", "canvas.viewbox.changed"], AFTER_DIAGRAM_JS, () =>
      this.schedulePlacement(),
    );
    eventBus.on("contextPad.close", () => {
      this.openPad = undefined;
      this.scheduler.cancel(PLACEMENT_TASK);
    });
  }

  private schedulePlacement(): void {
    void this.scheduler.schedule(() => this.keepInsideFreeArea(), PLACEMENT_TASK);
  }

  private keepInsideFreeArea(): void {
    const pad = this.openPad;
    if (!pad || !pad.html.classList.contains("open")) return;
    const containerBox = this.canvas.getContainer().getBoundingClientRect();
    if (!(containerBox.width > 0 && containerBox.height > 0)) return;
    const target = this.targetBox(pad.target, containerBox);
    // An element scrolled out of the container takes its pad along, as diagram-js places it.
    if (
      !target ||
      target.right < 0 ||
      target.bottom < 0 ||
      target.left > containerBox.width ||
      target.top > containerBox.height
    ) {
      return;
    }

    const left = parseFloat(pad.html.style.left);
    const top = parseFloat(pad.html.style.top);
    if (!Number.isFinite(left) || !Number.isFinite(top)) return;

    const insets = this.config?.freeArea?.insets?.() ?? NO_INSETS;
    const free: Box = {
      left: insets.left,
      top: insets.top,
      right: containerBox.width - insets.right,
      bottom: containerBox.height - insets.bottom,
    };
    const width = pad.html.offsetWidth;
    const height = pad.html.offsetHeight;
    const gap = PAD_GAP * this.canvas.zoom();

    let placedLeft = left;
    if (left + width > free.right) {
      // A connection's pad sits at its end point, so it flips around that point.
      const anchorLeft = isConnection(pad.target) ? left - gap : target.left;
      const flipped = anchorLeft - gap - width;
      const flippedFits = flipped >= free.left && flipped + width <= free.right;
      placedLeft = flippedFits ? flipped : free.right - width;
    }
    placedLeft = Math.max(free.left, placedLeft);
    const placedTop = Math.max(free.top, Math.min(top, free.bottom - height));

    if (placedLeft !== left) pad.html.style.left = `${placedLeft}px`;
    if (placedTop !== top) pad.html.style.top = `${placedTop}px`;
  }

  /** The box around the pad's element(s) in px from the container's top left, as diagram-js reads it. */
  private targetBox(target: Element | Element[], containerBox: DOMRect): Box | undefined {
    const elements = Array.isArray(target) ? target : [target];
    let box: Box | undefined;
    for (const element of elements) {
      const graphics = this.canvas.getGraphics(element.id) as SVGElement | undefined;
      if (!graphics) continue;
      const bounds = graphics.getBoundingClientRect();
      const elementBox = {
        left: bounds.left - containerBox.left,
        top: bounds.top - containerBox.top,
        right: bounds.right - containerBox.left,
        bottom: bounds.bottom - containerBox.top,
      };
      box = box
        ? {
            left: Math.min(box.left, elementBox.left),
            top: Math.min(box.top, elementBox.top),
            right: Math.max(box.right, elementBox.right),
            bottom: Math.max(box.bottom, elementBox.bottom),
          }
        : elementBox;
    }
    return box;
  }
}
