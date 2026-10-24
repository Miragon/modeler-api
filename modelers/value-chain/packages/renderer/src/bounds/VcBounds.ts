import type ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import type { Element } from "diagram-js/lib/model/Types";
import { getBBox } from "diagram-js/lib/util/Elements";
import type { Bounds } from "@miragon/value-chain-schema-model";
import type VcRenderer from "../draw/VcRenderer.js";
import { isVcElement, isVcShape } from "../model/di-types.js";

/**
 * The extent of the diagram's content: every step, org unit and connection (waypoints included)
 * and every label, also where its text runs past its shape. One source for the import's fit, the
 * SVG export's frame and a host's fit, which pass their own margin.
 */
export default class VcBounds {
  static $inject = ["elementRegistry", "vcRenderer"];

  constructor(
    private readonly elementRegistry: ElementRegistry,
    private readonly vcRenderer: VcRenderer,
  ) {}

  /** No step and no org unit on the canvas. */
  isEmpty(): boolean {
    return !this.elementRegistry.getAll().some(isVcShape);
  }

  /** The tight bounds of the content grown by `padding` on every side; undefined while empty. */
  contentBounds(padding = 0): Bounds | undefined {
    if (this.isEmpty()) {
      return undefined;
    }
    const elements = this.elementRegistry.filter(isVcElement) as Element[];
    const labels = elements
      .filter(isVcShape)
      .flatMap((shape) => this.vcRenderer.labelBounds(shape) ?? []);
    // getBBox takes any box as the rect it spans, as it does for the waypoints of a connection.
    const { x, y, width, height } = getBBox([...elements, ...labels] as Element[]);
    return {
      x: x - padding,
      y: y - padding,
      width: width + 2 * padding,
      height: height + 2 * padding,
    };
  }
}
