/**
 * Enforces a fixed stacking order regardless of creation order, by reordering
 * the element graphics within the canvas layer. Back → front:
 *
 *   relationships  <  contexts
 *
 * So the relationship lines always read behind the context boxes and appear to
 * dock to the box borders (the segment inside a box is covered by the box).
 */

import type Canvas from "diagram-js/lib/core/Canvas";
import type ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import type EventBus from "diagram-js/lib/core/EventBus";
import { isCmElement, isCmRelationship, type CmElement } from "../model/di-types.js";

/** Lower = further back. */
function tier(el: CmElement): number {
  return isCmRelationship(el) ? 0 : 1;
}

export default class CmZOrder {
  static $inject = ["eventBus", "canvas", "elementRegistry"];

  private importing = false;

  constructor(
    eventBus: EventBus,
    private readonly canvas: Canvas,
    private readonly elementRegistry: ElementRegistry,
  ) {
    eventBus.on("import.render.start", () => {
      this.importing = true;
    });
    eventBus.on("import.render.done", () => {
      this.importing = false;
      this.reorder();
    });
    eventBus.on("commandStack.changed", () => {
      if (!this.importing) this.reorder();
    });
  }

  /** Re-append each element's graphics group in ascending tier order (back → front). */
  reorder(): void {
    const ordered = (this.elementRegistry.getAll().filter(isCmElement) as CmElement[]).sort(
      (a, b) => tier(a) - tier(b),
    );
    for (const el of ordered) {
      const gfx = this.canvas.getGraphics(el) as SVGElement | undefined;
      const wrapper = gfx?.parentNode as (Node & ChildNode) | null;
      const layer = wrapper?.parentNode as (Node & { appendChild(n: Node): Node }) | null;
      if (wrapper && layer) layer.appendChild(wrapper);
    }
  }
}
