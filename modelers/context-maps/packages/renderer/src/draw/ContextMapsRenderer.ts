/**
 * SVG rendering of the Context Maps notation (BaseRenderer subclass).
 *
 *  - bounded contexts: solid resizable boxes, coloured by subdomain type, with a
 *    wrapped name and an optional owning-team caption;
 *  - relationships: lines between contexts carrying the pattern abbreviation
 *    (e.g. "SK", "C/S"), U/D end markers for asymmetric patterns, and the
 *    integration roles (OHS/PL upstream, ACL/CF downstream).
 *
 * Colours/labels come from the single notation source (`@miragon/context-maps-schema-model`).
 */

import BaseRenderer from "diagram-js/lib/draw/BaseRenderer";
import {
  append as svgAppend,
  create as svgCreate,
  attr as svgAttr,
  clear as svgClear,
} from "tiny-svg";
import type EventBus from "diagram-js/lib/core/EventBus";
import type { ConnectionLike, ElementLike, ShapeLike } from "diagram-js/lib/model/Types";
import type { Point } from "diagram-js/lib/util/Types";
import {
  MARK_COLORS,
  MARK_TEXT_COLOR,
  RELATIONSHIP_PATTERN_SPECS,
  SUBDOMAIN_TYPE_SPECS,
} from "@miragon/context-maps-schema-model";
import type { SubdomainType } from "@miragon/context-maps-schema-model";
import { FONT, INK, INK_SOFT, PAPER, TT_RENDER_PRIORITY } from "./styles.js";
import { endRoleChipLayout } from "./endRoleChips.js";
import {
  isCmContext,
  isCmElement,
  isCmRelationship,
  type CmContext,
  type CmRelationship,
} from "../model/di-types.js";

type Attrs = Record<string, string | number>;

const NEUTRAL_FILL = "#F1F1EE";
const NEUTRAL_STROKE = "#8A8577";

export default class ContextMapsRenderer extends BaseRenderer {
  static $inject = ["eventBus"];

  constructor(eventBus: EventBus) {
    super(eventBus, TT_RENDER_PRIORITY);
  }

  override canRender(element: ElementLike): boolean {
    return isCmElement(element);
  }

  override drawShape(visuals: SVGElement, element: ShapeLike): SVGElement {
    // diagram-js does not always clear our visual group before re-rendering on
    // update; clear it ourselves so re-draws never leave stale duplicates behind.
    svgClear(visuals);
    if (isCmContext(element)) return this.drawContext(visuals, element);
    const rect = svgAttr(svgCreate("rect"), {
      width: element.width,
      height: element.height,
      fill: "#eee",
    });
    svgAppend(visuals, rect);
    return rect;
  }

  override drawConnection(visuals: SVGElement, connection: ConnectionLike): SVGElement {
    svgClear(visuals);
    if (isCmRelationship(connection)) return this.drawRelationship(visuals, connection);
    const line = svgAttr(svgCreate("polyline"), {
      points: (connection.waypoints ?? []).map((p) => `${p.x},${p.y}`).join(" "),
      fill: "none",
      stroke: INK,
    });
    svgAppend(visuals, line);
    return line;
  }

  override getShapePath(shape: ShapeLike): string {
    const { x, y, width, height } = shape;
    return `M${x},${y}l${width},0l0,${height}l${-width},0z`;
  }

  override getConnectionPath(connection: ConnectionLike): string {
    const wp = (connection.waypoints ?? []) as Point[];
    if (wp.length === 0) return "";
    return wp.map((p, idx) => `${idx === 0 ? "M" : "L"}${p.x},${p.y}`).join("");
  }

  // --- bounded context -----------------------------------------------------

  private drawContext(visuals: SVGElement, ctx: CmContext): SVGElement {
    const spec = ctx.subdomainType ? SUBDOMAIN_TYPE_SPECS[ctx.subdomainType] : undefined;
    const w = Math.max(ctx.width, 1);
    const h = Math.max(ctx.height, 1);
    const sw = 2;
    const i = sw / 2;
    const box = svgAttr(svgCreate("rect"), {
      x: i,
      y: i,
      width: w - sw,
      height: h - sw,
      rx: 8,
      ry: 8,
      fill: ctx.fill ?? spec?.fill ?? NEUTRAL_FILL,
      stroke: ctx.stroke ?? spec?.stroke ?? NEUTRAL_STROKE,
      "stroke-width": sw,
      "stroke-linejoin": "round",
    });
    svgAppend(visuals, box);

    const hasTeam = Boolean(ctx.team);
    this.appendLabel(visuals, ctx.cmLabel ?? "", w, hasTeam ? h - 18 : h, {
      "font-weight": "650",
    });
    if (ctx.subdomainType && spec) {
      // Kaiser subdomain icon at the top-left corner (star / open hand / dotted
      // circle) plus the domain-type label next to it.
      svgAppend(visuals, subdomainIcon(ctx.subdomainType, 15, 15, 18, spec.stroke));
      const badge = svgAttr(svgCreate("text"), {
        x: 28,
        y: 15,
        "font-family": FONT.family,
        "font-size": FONT.small,
        "font-weight": "700",
        fill: spec.stroke,
        "text-anchor": "start",
        "dominant-baseline": "central",
        "letter-spacing": "0.03em",
      });
      badge.textContent = spec.label;
      svgAppend(visuals, badge);
    }
    if (ctx.team) {
      // People icon + team name, centred as a unit at the bottom of the box.
      const textWidth = ctx.team.length * FONT.small * 0.55;
      const iconSize = 14;
      const gap = 5;
      const totalWidth = iconSize + gap + textWidth;
      const startX = w / 2 - totalWidth / 2;
      const cy = h - 12;

      svgAppend(visuals, peopleIcon(startX + iconSize / 2, cy, iconSize, INK_SOFT));

      const team = svgAttr(svgCreate("text"), {
        x: startX + iconSize + gap,
        y: cy,
        "font-family": FONT.family,
        "font-size": FONT.small,
        fill: INK_SOFT,
        "text-anchor": "start",
        "dominant-baseline": "central",
      });
      team.textContent = ctx.team;
      svgAppend(visuals, team);
    }
    return box;
  }

  // --- relationship --------------------------------------------------------

  private drawRelationship(visuals: SVGElement, rel: CmRelationship): SVGElement {
    const spec =
      RELATIONSHIP_PATTERN_SPECS[rel.pattern] ?? RELATIONSHIP_PATTERN_SPECS["upstream-downstream"];
    const wp = (rel.waypoints ?? []) as Point[];
    const dash = spec.dash;
    const line = svgAttr(svgCreate("polyline"), {
      points: wp.map((p) => `${p.x},${p.y}`).join(" "),
      fill: "none",
      stroke: spec.stroke,
      "stroke-width": spec.strokeWidth,
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
      ...(dash ? { "stroke-dasharray": dash } : {}),
    });
    svgAppend(visuals, line);

    if (wp.length >= 2) {
      const src = wp[0];
      const tgt = wp[wp.length - 1];
      const upRoles = rel.upstreamRoles ?? [];
      const downRoles = rel.downstreamRoles ?? [];

      if (spec.symmetric) {
        // No direction (SK / P / SW): a single neutral pattern chip in the MIDDLE.
        const mx = (src.x + tgt.x) / 2;
        const my = (src.y + tgt.y) / 2;
        this.chip(visuals, mx, my, spec.abbreviation, PAPER, spec.stroke, spec.stroke);
      } else {
        // Direction letter sits AT the domain as a plain letter (no box); the
        // integration roles follow as their own coloured boxes. Customer-supplier
        // uses S (supplier, upstream) and C (customer, downstream) instead of U/D.
        const cs = rel.pattern === "customer-supplier";
        this.endMarkers(visuals, src, tgt, cs ? "S" : "U", upRoles);
        this.endMarkers(visuals, tgt, src, cs ? "C" : "D", downRoles);
      }
    }
    return line;
  }

  /**
   * Draws the markers at one relationship end: the direction letter (U/D/S/C) as
   * a plain letter right at the domain (no box), then the integration roles side
   * by side inside a single axis-aligned parent box.
   */
  private endMarkers(
    visuals: SVGElement,
    endpoint: Point,
    toward: Point,
    direction: string,
    roles: string[],
  ): void {
    const dx = toward.x - endpoint.x;
    const dy = toward.y - endpoint.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;

    // Direction letter: plain bold letter at the domain, white halo for legibility.
    const letterDist = 11;
    const dirColor = MARK_COLORS[direction] ?? INK;
    const letter = svgAttr(svgCreate("text"), {
      x: endpoint.x + ux * letterDist,
      y: endpoint.y + uy * letterDist,
      "font-family": FONT.family,
      "font-size": FONT.small + 1,
      "font-weight": "800",
      fill: dirColor,
      stroke: PAPER,
      "stroke-width": 3,
      "paint-order": "stroke",
      "text-anchor": "middle",
      "dominant-baseline": "central",
    });
    letter.textContent = direction;
    svgAppend(visuals, letter);

    // Integration roles: horizontal chips inside one axis-aligned parent box
    // (geometry shared with the validation markers via endRoleChipLayout).
    const layout = endRoleChipLayout(endpoint, toward, direction, roles);
    if (!layout) return;
    const { box, center, chipWidths: widths, chipHeight: chipH, innerWidth: innerW, gap } = layout;
    const cy = center.y;

    const parent = svgAttr(svgCreate("rect"), {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      rx: 6,
      ry: 6,
      fill: PAPER,
      "fill-opacity": 0.96,
      stroke: "#d9d5cc",
      "stroke-width": 1,
    });
    svgAppend(visuals, parent);

    let x = center.x - innerW / 2;
    roles.forEach((role, i) => {
      const w = widths[i];
      const fill = MARK_COLORS[role] ?? NEUTRAL_STROKE;
      this.miniChip(visuals, x + w / 2, cy, w, chipH, role, fill);
      x += w + gap;
    });
  }

  /** A fixed-size coloured sub-label (own colour + border) inside a parent box. */
  private miniChip(
    visuals: SVGElement,
    cx: number,
    cy: number,
    w: number,
    h: number,
    text: string,
    fill: string,
  ): void {
    const bg = svgAttr(svgCreate("rect"), {
      x: cx - w / 2,
      y: cy - h / 2,
      width: w,
      height: h,
      rx: 3,
      ry: 3,
      fill,
      stroke: darken(fill),
      "stroke-width": 1,
    });
    svgAppend(visuals, bg);
    const t = svgAttr(svgCreate("text"), {
      x: cx,
      y: cy,
      "font-family": FONT.family,
      "font-size": FONT.small,
      "font-weight": "700",
      fill: MARK_TEXT_COLOR,
      "text-anchor": "middle",
      "dominant-baseline": "central",
    });
    t.textContent = text;
    svgAppend(visuals, t);
  }

  /** A single small filled, bordered box (background, text colour, border colour). */
  private chip(
    visuals: SVGElement,
    cx: number,
    cy: number,
    text: string,
    bgFill: string,
    textFill: string,
    border: string,
  ): void {
    if (!text) return;
    const padX = 6;
    const charW = FONT.small * 0.64;
    const w = text.length * charW + padX * 2;
    const h = FONT.small + 8;
    const bg = svgAttr(svgCreate("rect"), {
      x: cx - w / 2,
      y: cy - h / 2,
      width: w,
      height: h,
      rx: 4,
      ry: 4,
      fill: bgFill,
      stroke: border,
      "stroke-width": 1,
      ...(bgFill === PAPER ? { "fill-opacity": 0.95 } : {}),
    });
    svgAppend(visuals, bg);
    const t = svgAttr(svgCreate("text"), {
      x: cx,
      y: cy,
      "font-family": FONT.family,
      "font-size": FONT.small,
      "font-weight": "700",
      fill: textFill,
      "text-anchor": "middle",
      "dominant-baseline": "central",
    });
    t.textContent = text;
    svgAppend(visuals, t);
  }

  // --- shared label rendering (wrapped, centred) ---------------------------

  private appendLabel(visuals: SVGElement, text: string, w: number, h: number, attrs: Attrs): void {
    const fontSize =
      typeof attrs["font-size"] === "number" ? (attrs["font-size"] as number) : FONT.label;
    const lines = wrapLabel(text, w - 20, fontSize);
    const lineHeight = fontSize * 1.2;
    const startY = h / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((ln, idx) => {
      const t = svgAttr(svgCreate("text"), {
        x: w / 2,
        y: startY + idx * lineHeight,
        "font-family": FONT.family,
        "font-size": fontSize,
        fill: INK,
        "text-anchor": "middle",
        "dominant-baseline": "central",
        ...attrs,
      });
      t.textContent = ln;
      svgAppend(visuals, t);
    });
  }
}

// --- helpers ---------------------------------------------------------------

/** Darkens a #rrggbb colour toward black by factor `f` (0..1) for chip borders. */
function darken(hex: string, f = 0.7): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

// Material star + pan_tool (open hand) paths (Apache-2.0), 24×24 viewBox.
const STAR_PATH =
  "M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 7.1-1.01z";
const HAND_PATH =
  "M23 5.5V20c0 2.2-1.8 4-4 4h-7.3c-1.08 0-2.1-.43-2.85-1.19L1 14.83s1.26-1.23 1.3-1.25c.22-.19.49-.29.79-.29.22 0 .42.06.6.16.04.01 4.31 2.46 4.31 2.46V4c0-.83.67-1.5 1.5-1.5S11 3.17 11 4v7h1V1.5c0-.83.67-1.5 1.5-1.5S15 .67 15 1.5V11h1V2.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V11h1V5.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5z";

/**
 * Kaiser subdomain icon centred on (cx, cy) at `size` px: a filled star for a
 * core domain, an open hand for a supporting subdomain, a dotted circle for a
 * generic subdomain.
 */
function subdomainIcon(
  type: SubdomainType,
  cx: number,
  cy: number,
  size: number,
  color: string,
): SVGElement {
  if (type === "generic") {
    const g = svgCreate("g");
    const c = svgAttr(svgCreate("circle"), {
      cx,
      cy,
      r: size / 2 - 1,
      fill: "none",
      stroke: color,
      "stroke-width": 1.6,
      "stroke-dasharray": "2.2 2.2",
    });
    svgAppend(g, c);
    return g;
  }
  const scale = size / 24;
  // The open hand is drawn upright by Material; rotate it to lie sideways.
  const rot = type === "supporting" ? " rotate(90 12 12)" : "";
  const g = svgCreate("g");
  svgAttr(g, {
    transform: `translate(${cx - 12 * scale} ${cy - 12 * scale}) scale(${scale})${rot}`,
  });
  const path = svgAttr(svgCreate("path"), {
    d: type === "core" ? STAR_PATH : HAND_PATH,
    fill: color,
  });
  svgAppend(g, path);
  return g;
}

// Material "people" icon (Apache-2.0), 24×24 viewBox.
const PEOPLE_PATH =
  "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z";

/** A people glyph centred on (cx, cy), rendered at `size` px in the given colour. */
function peopleIcon(cx: number, cy: number, size: number, color: string): SVGElement {
  const scale = size / 24;
  const g = svgCreate("g");
  svgAttr(g, { transform: `translate(${cx - 12 * scale} ${cy - 12 * scale}) scale(${scale})` });
  const path = svgAttr(svgCreate("path"), { d: PEOPLE_PATH, fill: color });
  svgAppend(g, path);
  return g;
}

/** Greedy word-wrap into lines that roughly fit `maxWidth` at the font size. */
function wrapLabel(text: string, maxWidth: number, fontSize: number): string[] {
  const maxChars = Math.max(4, Math.floor(maxWidth / (fontSize * 0.58)));
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const candidate = cur ? `${cur} ${word}` : word;
    if (candidate.length > maxChars && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = candidate;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
