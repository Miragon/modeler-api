/**
 * Keeps the context pad inside the free area: the canvas container minus the `freeArea.insets` a
 * host passes (contract option of `@miragon/modeler-api` 1.2), the whole container without them.
 * diagram-js puts the pad right of its element, top-aligned, and never looks at the edges, so for
 * a shape in the bottom right corner the vertical pad would run under the host's bottom chrome or
 * out of the container. Here a pad that would pass the right edge flips to the left of its
 * element, one that would pass the bottom moves up and one above the top moves down; where the
 * free area is too small, its top left corner wins, so the first entries stay reachable.
 *
 * diagram-js writes the pad's position in a task of its own. The pad moves in the microtask right
 * after that write, before the page paints, so it never shows where diagram-js put it. A resized
 * container, which diagram-js gives no new position, places it again from diagram-js's last one.
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

/** px from the canvas container's top left, as diagram-js writes the pad's `left` and `top`. */
interface Position {
  left: number;
  top: number;
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

function positionOf(html: HTMLElement): Position | undefined {
  const left = parseFloat(html.style.left);
  const top = parseFloat(html.style.top);
  return Number.isFinite(left) && Number.isFinite(top) ? { left, top } : undefined;
}

export default class TtContextPadPlacement {
  static $inject = ["config.ttContextPad", "eventBus", "canvas", "scheduler"];

  private openPad: OpenPad | undefined;
  /** Where diagram-js last put the open pad; every placement starts from it. */
  private diagramJsPosition: Position | undefined;
  private positionWrites: MutationObserver | undefined;

  constructor(
    private readonly config: TtContextPadConfig | undefined,
    eventBus: EventBus,
    private readonly canvas: Canvas,
    private readonly scheduler: Scheduler,
  ) {
    eventBus.on("contextPad.open", (event: { current: OpenPad }) => this.follow(event.current));
    // diagram-js may write the same position again, which changes nothing to observe, while the
    // free area has changed; a resize gets no new position at all.
    eventBus.on(
      ["contextPad.show", "canvas.viewbox.changed", "canvas.resized"],
      AFTER_DIAGRAM_JS,
      () => this.schedulePlacement(),
    );
    eventBus.on(["contextPad.close", "diagram.destroy"], () => this.stopFollowing());
  }

  private follow(pad: OpenPad): void {
    this.stopFollowing();
    this.openPad = pad;
    const positionWrites = new MutationObserver(() => {
      this.diagramJsPosition = positionOf(pad.html);
      this.keepInsideFreeArea();
    });
    positionWrites.observe(pad.html, { attributes: true, attributeFilter: ["style"] });
    this.positionWrites = positionWrites;
  }

  private stopFollowing(): void {
    this.positionWrites?.disconnect();
    this.positionWrites = undefined;
    this.openPad = undefined;
    this.diagramJsPosition = undefined;
    this.scheduler.cancel(PLACEMENT_TASK);
  }

  private schedulePlacement(): void {
    void this.scheduler.schedule(() => this.keepInsideFreeArea(), PLACEMENT_TASK);
  }

  private keepInsideFreeArea(): void {
    const pad = this.openPad;
    const from = this.diagramJsPosition;
    if (!pad || !from || !pad.html.classList.contains("open")) return;
    const containerBox = this.canvas.getContainer().getBoundingClientRect();
    if (!(containerBox.width > 0 && containerBox.height > 0)) return;
    this.moveTo(pad.html, this.placementFor(pad, from, containerBox));
  }

  private placementFor(pad: OpenPad, from: Position, containerBox: DOMRect): Position {
    const target = this.targetBox(pad.target, containerBox);
    // An element scrolled out of the container takes its pad along, as diagram-js places it.
    if (
      !target ||
      target.right < 0 ||
      target.bottom < 0 ||
      target.left > containerBox.width ||
      target.top > containerBox.height
    ) {
      return from;
    }

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

    let left = from.left;
    if (left + width > free.right) {
      // A connection's pad sits at its end point, so it flips around that point.
      const anchorLeft = isConnection(pad.target) ? left - gap : target.left;
      const flipped = anchorLeft - gap - width;
      const flippedFits = flipped >= free.left && flipped + width <= free.right;
      left = flippedFits ? flipped : free.right - width;
    }
    return {
      left: Math.max(free.left, left),
      top: Math.max(free.top, Math.min(from.top, free.bottom - height)),
    };
  }

  private moveTo(html: HTMLElement, position: Position): void {
    const current = positionOf(html);
    if (current?.left === position.left && current.top === position.top) return;
    html.style.left = `${position.left}px`;
    html.style.top = `${position.top}px`;
    // Only diagram-js's writes count as its position, never this one.
    this.positionWrites?.takeRecords();
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
