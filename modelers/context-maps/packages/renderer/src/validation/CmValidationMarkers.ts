/**
 * Live semantic-rule markers on the canvas: a relationship with validation
 * findings gets a small warning triangle next to the issue — amber for
 * warnings, red if any finding is an error. Sided findings (e.g. an ACL issue
 * is a downstream concern) anchor at the BOTTOM-RIGHT corner of that end's
 * role-chip box (geometry shared with the renderer via endRoleChipLayout);
 * findings about the relationship as a whole sit at the middle of the line.
 * Hovering shows the message(s) instantly via a CSS tooltip (a native `title`
 * would only appear after the OS hover delay). Implemented as diagram-js
 * overlays (HTML above the SVG), so hover is not swallowed by the connection
 * hit layer and the marker follows its element. Recomputed on every change.
 */

import type EventBus from "diagram-js/lib/core/EventBus";
import type ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import type Overlays from "diagram-js/lib/features/overlays/Overlays";
import type { Point } from "diagram-js/lib/util/Types";
import { validateDocument, type SemanticFinding } from "@miragon/context-maps-schema-model";
import type CmExporter from "../io/CmExporter.js";
import { isCmRelationship, type CmRelationship } from "../model/di-types.js";
import { endRoleChipLayout } from "../draw/endRoleChips.js";

const OVERLAY_TYPE = "cm-validation";
const MARKER_SIZE = 20;
const LINE_OFFSET = 16;
/** Fallback distance from the endpoint when the end has no role chips. */
const END_DISTANCE = 44;

type MarkerSide = "upstream" | "downstream" | "middle";

const AMBER = "#d97706";
const RED = "#dc2626";

interface RankedFinding extends SemanticFinding {
  kind: "error" | "warning";
}

function markerHtml(findings: RankedFinding[]): HTMLElement {
  const hasError = findings.some((finding) => finding.kind === "error");
  const fill = hasError ? RED : AMBER;
  const marker = document.createElement("div");
  marker.className = "cm-validation-marker";
  marker.innerHTML =
    `<svg width="${MARKER_SIZE}" height="${MARKER_SIZE}" viewBox="0 0 24 24">` +
    `<path d="M12 2.5 23 21.5H1Z" fill="${fill}" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<text x="12" y="18.5" text-anchor="middle" font-size="12" font-weight="800" fill="#fff" font-family="system-ui, sans-serif">!</text>` +
    `</svg>`;

  const tooltip = document.createElement("div");
  tooltip.className = "cm-validation-tooltip";
  for (const finding of findings) {
    const message = document.createElement("div");
    message.className = "cm-validation-tooltip__message";
    message.textContent = finding.message;
    tooltip.appendChild(message);
  }
  marker.appendChild(tooltip);
  return marker;
}

/**
 * Where the marker sits. Sided findings anchor at the bottom-right corner of
 * the role-chip box of that end (that is where the offending OHS/PL/ACL/CF
 * badge is drawn); without chips they fall back to a point near the endpoint.
 * Whole-relationship findings sit at the middle of the line, nudged off it.
 */
function anchorPoint(relationship: CmRelationship, waypoints: Point[], side: MarkerSide): Point {
  const start = waypoints[0];
  const end = waypoints[waypoints.length - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;

  if (side === "middle") {
    return {
      x: (start.x + end.x) / 2 + -uy * LINE_OFFSET,
      y: (start.y + end.y) / 2 + ux * LINE_OFFSET,
    };
  }

  const customerSupplier = relationship.pattern === "customer-supplier";
  const layout =
    side === "upstream"
      ? endRoleChipLayout(start, end, customerSupplier ? "S" : "U", relationship.upstreamRoles ?? [])
      : endRoleChipLayout(end, start, customerSupplier ? "C" : "D", relationship.downstreamRoles ?? []);
  if (layout) {
    // Centred (almost) on the chip box corner: the triangle's visible body is
    // bottom-heavy, so half the marker overlapping the corner reads as sitting
    // right AT the corner instead of floating next to it.
    const corner = { x: layout.box.x + layout.box.width, y: layout.box.y + layout.box.height };
    return { x: corner.x + 1, y: corner.y + 1 };
  }

  const along = Math.min(END_DISTANCE, length * 0.35);
  const baseX = side === "upstream" ? start.x + ux * along : end.x - ux * along;
  const baseY = side === "upstream" ? start.y + uy * along : end.y - uy * along;
  return { x: baseX + -uy * LINE_OFFSET, y: baseY + ux * LINE_OFFSET };
}

export default class CmValidationMarkers {
  static $inject = ["eventBus", "elementRegistry", "overlays", "cmExporter"];

  constructor(
    eventBus: EventBus,
    private readonly elementRegistry: ElementRegistry,
    private readonly overlays: Overlays,
    private readonly exporter: CmExporter,
  ) {
    const refresh = (): void => this.refresh();
    eventBus.on("import.render.done", refresh);
    eventBus.on("commandStack.changed", refresh);
  }

  private refresh(): void {
    this.overlays.remove({ type: OVERLAY_TYPE });

    const report = validateDocument(this.exporter.export());
    // One marker per relationship END the findings point at (or the middle for
    // whole-relationship findings), so the triangle sits next to the issue.
    const byAnchor = new Map<string, { relationshipId: string; findings: RankedFinding[] }>();
    const collect = (findings: SemanticFinding[], kind: RankedFinding["kind"]): void => {
      for (const finding of findings) {
        if (!finding.relationshipId) continue;
        const key = `${finding.relationshipId} ${finding.side ?? "middle"}`;
        const group = byAnchor.get(key) ?? { relationshipId: finding.relationshipId, findings: [] };
        group.findings.push({ ...finding, kind });
        byAnchor.set(key, group);
      }
    };
    collect(report.errors, "error");
    collect(report.warnings, "warning");

    for (const [key, group] of byAnchor) {
      const element = this.elementRegistry.get(group.relationshipId);
      if (!isCmRelationship(element)) continue;
      const waypoints = (element.waypoints ?? []) as Point[];
      if (waypoints.length < 2) continue;
      const side = key.split(" ")[1] as MarkerSide;
      const { x: markerX, y: markerY } = anchorPoint(element, waypoints, side);

      // Overlay positions on a connection are relative to its waypoint bbox.
      const bboxX = Math.min(...waypoints.map((p) => p.x));
      const bboxY = Math.min(...waypoints.map((p) => p.y));
      this.overlays.add(element, OVERLAY_TYPE, {
        position: {
          left: markerX - bboxX - MARKER_SIZE / 2,
          top: markerY - bboxY - MARKER_SIZE / 2,
        },
        html: markerHtml(group.findings),
      });
    }
  }
}
