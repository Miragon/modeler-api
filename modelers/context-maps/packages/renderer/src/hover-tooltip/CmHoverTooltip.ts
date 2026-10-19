/**
 * A fast hover tooltip for the map's own data (the native SVG <title> waits about 1.5s): a
 * context's description and team, a relationship's pattern, label, description and technology.
 * What the notation itself means lives in the legend. One element inside the canvas container, so
 * it never covers the chrome around the canvas, and it follows the pointer while it rests on an
 * element.
 */

import type Canvas from "diagram-js/lib/core/Canvas";
import type EventBus from "diagram-js/lib/core/EventBus";
import { RELATIONSHIP_PATTERN_SPECS } from "@miragon/context-maps-schema-model";
import type { RelationshipPatternSpec } from "@miragon/context-maps-schema-model";
import { isCmContext, isCmRelationship } from "../model/di-types.js";

interface HoverTip {
  title: string;
  body: string;
}

/** Gap between the pointer and the tooltip, in px. */
const POINTER_OFFSET = { x: 14, y: 18 };
/** Distance the tooltip keeps from the container's right edge, in px. */
const EDGE_MARGIN = 12;

export function hoverTipFor(element: unknown): HoverTip | null {
  if (isCmContext(element)) {
    const parts: string[] = [];
    if (element.description) parts.push(element.description);
    if (element.team) parts.push(`Team: ${element.team}`);
    if (parts.length === 0) return null;
    return { title: element.cmLabel ?? "Bounded context", body: parts.join(" · ") };
  }
  if (isCmRelationship(element)) {
    const spec = RELATIONSHIP_PATTERN_SPECS[element.pattern] as RelationshipPatternSpec | undefined;
    const pattern = spec?.label ?? element.pattern;
    const parts: string[] = [];
    if (element.description) parts.push(element.description);
    if (element.implementationTechnology) parts.push(element.implementationTechnology);
    const title = element.cmLabel ? `${pattern} · ${element.cmLabel}` : pattern;
    return { title, body: parts.join(" · ") };
  }
  return null;
}

export default class CmHoverTooltip {
  static $inject = ["eventBus", "canvas"];

  private readonly tooltip: HTMLElement;
  private readonly title: HTMLElement;
  private readonly body: HTMLElement;

  constructor(eventBus: EventBus, canvas: Canvas) {
    const container = canvas.getContainer();
    this.tooltip = document.createElement("div");
    this.tooltip.className = "cm-hover-tooltip";
    this.tooltip.setAttribute("role", "tooltip");
    this.tooltip.hidden = true;
    this.title = document.createElement("strong");
    this.body = document.createElement("span");
    this.tooltip.append(this.title, this.body);
    container.append(this.tooltip);

    const place = (event: MouseEvent): void => {
      const bounds = container.getBoundingClientRect();
      const width = this.tooltip.offsetWidth;
      const left = Math.min(
        event.clientX - bounds.left + POINTER_OFFSET.x,
        bounds.width - width - EDGE_MARGIN,
      );
      this.tooltip.style.left = `${Math.max(EDGE_MARGIN, left)}px`;
      this.tooltip.style.top = `${event.clientY - bounds.top + POINTER_OFFSET.y}px`;
    };
    const hide = (): void => {
      this.tooltip.hidden = true;
      container.removeEventListener("mousemove", place);
    };

    eventBus.on("element.hover", (event: { element?: unknown; originalEvent?: MouseEvent }) => {
      const tip = hoverTipFor(event.element);
      if (!tip) {
        hide();
        return;
      }
      this.title.textContent = tip.title;
      this.body.textContent = tip.body;
      this.body.hidden = tip.body === "";
      this.tooltip.hidden = false;
      if (event.originalEvent) place(event.originalEvent);
      container.addEventListener("mousemove", place);
    });
    eventBus.on(["element.out", "drag.init", "canvas.viewbox.changing", "diagram.clear"], hide);
    eventBus.on("diagram.destroy", () => {
      hide();
      this.tooltip.remove();
    });
  }
}
