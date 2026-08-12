/**
 * A fast custom hover tooltip (native SVG <title> has a ~1.5s browser delay).
 * Vanilla-DOM twin of the webapp's `HoverTooltip.tsx`: subscribes to diagram-js
 * hover events and immediately shows the hovered element's OWN data — its
 * description (plus team / technology). What the notation itself means lives
 * exclusively in the legend at the bottom.
 */

import { isCmContext, isCmRelationship } from "@miragon/context-maps-renderer";
import type { CmContext, CmRelationship, Modeler } from "@miragon/context-maps-renderer";
import { RELATIONSHIP_PATTERN_SPECS } from "@miragon/context-maps-schema-model";

interface Tip {
  title: string;
  body: string;
}

function tipFor(element: unknown): Tip | null {
  if (isCmContext(element)) {
    const context = element as CmContext;
    const parts: string[] = [];
    if (context.description) parts.push(context.description);
    if (context.team) parts.push(`Team: ${context.team}`);
    if (parts.length === 0) return null;
    return { title: context.cmLabel ?? "Bounded Context", body: parts.join(" · ") };
  }
  if (isCmRelationship(element)) {
    const relationship = element as CmRelationship;
    const spec = RELATIONSHIP_PATTERN_SPECS[relationship.pattern];
    const parts: string[] = [];
    if (relationship.description) parts.push(relationship.description);
    if (relationship.implementationTechnology) parts.push(relationship.implementationTechnology);
    const title = relationship.cmLabel ? `${spec.label} · ${relationship.cmLabel}` : spec.label;
    return { title, body: parts.join(" · ") };
  }
  return null;
}

export function mountHoverTooltip(modeler: Modeler, root: HTMLElement): void {
  const tooltip = document.createElement("div");
  tooltip.className = "cm-tooltip";
  tooltip.hidden = true;
  const title = document.createElement("strong");
  const body = document.createElement("span");
  tooltip.append(title, body);
  root.append(tooltip);

  let tracking = false;

  const place = (x: number, y: number): void => {
    // Keep the tooltip within the viewport horizontally.
    tooltip.style.left = `${Math.min(x + 14, window.innerWidth - 300)}px`;
    tooltip.style.top = `${y + 18}px`;
  };

  const onMove = (event: MouseEvent): void => place(event.clientX, event.clientY);

  const hide = (): void => {
    tooltip.hidden = true;
    if (tracking) {
      window.removeEventListener("mousemove", onMove);
      tracking = false;
    }
  };

  modeler.on("element.hover", (raw: unknown) => {
    const event = raw as { element?: unknown; originalEvent?: MouseEvent };
    const tip = tipFor(event.element);
    if (!tip) {
      hide();
      return;
    }
    title.textContent = tip.title;
    body.textContent = tip.body;
    body.hidden = tip.body === "";
    place(event.originalEvent?.clientX ?? 0, event.originalEvent?.clientY ?? 0);
    tooltip.hidden = false;
    if (!tracking) {
      window.addEventListener("mousemove", onMove);
      tracking = true;
    }
  });
  modeler.on("element.out", hide);
}
