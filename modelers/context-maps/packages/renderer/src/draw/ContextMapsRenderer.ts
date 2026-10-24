/**
 * SVG rendering of the Context Maps notation (BaseRenderer subclass).
 *
 *  - bounded contexts: solid fixed-size boxes, coloured by subdomain type, with
 *    a wrapped name and an optional owning-team caption;
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
  RELATIONSHIP_PATTERN_SPECS,
  SUBDOMAIN_TYPE_SPECS,
} from "@miragon/context-maps-schema-model";
import type { SubdomainType } from "@miragon/context-maps-schema-model";
import {
  CONTEXT_NAME_TOP,
  CONTEXT_TEAM_RESERVE,
  FONT,
  INK,
  PAPER,
  TT_RENDER_PRIORITY,
} from "./styles.js";
import {
  contextBadgeColour,
  contextFill,
  contextNameColour,
  contextStroke,
  contextTeamColour,
} from "./contextColours.js";
import {
  directionLetterColour,
  markFill,
  markTextColour,
  patternChipColours,
} from "./relationshipColours.js";
import { endRoleChipLayout } from "./endRoleChips.js";
import { LUCIDE, LUCIDE_STROKE_WIDTH } from "./lucide.js";
import { HAND_PATH, STAR_PATH } from "./subdomainGlyphs.js";
import { TEAM_ICON_SIZE, TYPE_LABEL, teamRowLayout } from "./contextLayout.js";
import { textWidth } from "./textMetrics.js";
import { MIRAGON } from "../theme/index.js";
import {
  isCmContext,
  isCmElement,
  isCmRelationship,
  type CmContext,
  type CmRelationship,
} from "../model/di-types.js";

type Attrs = Record<string, string | number>;

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
      fill: MIRAGON.grau,
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
      fill: contextFill(ctx),
      stroke: contextStroke(ctx),
      "stroke-width": sw,
      "stroke-linejoin": "round",
    });
    svgAppend(visuals, box);

    this.appendLabel(visuals, ctx.cmLabel ?? "", w, h, Boolean(ctx.team), {
      "font-weight": "650",
      fill: contextNameColour(ctx),
    });
    if (ctx.subdomainType && spec) {
      // Kaiser subdomain icon at the top-left corner (star / open hand / dotted
      // circle) plus the domain-type label next to it.
      const badgeColour = contextBadgeColour(ctx);
      svgAppend(visuals, subdomainIcon(ctx.subdomainType, 15, 15, 18, badgeColour));
      const badge = svgAttr(svgCreate("text"), {
        x: TYPE_LABEL.x,
        y: TYPE_LABEL.y,
        "font-family": FONT.family,
        "font-size": FONT.small,
        "font-weight": TYPE_LABEL.fontWeight,
        fill: badgeColour,
        "text-anchor": "start",
        "dominant-baseline": "central",
        "letter-spacing": `${TYPE_LABEL.letterSpacingEm}em`,
      });
      badge.textContent = spec.label;
      svgAppend(visuals, badge);
    }
    if (ctx.team) {
      // Team glyph + team name, centred as a unit at the bottom of the box.
      const row = teamRowLayout(w, h, ctx.team);
      const teamColour = contextTeamColour(ctx);
      const icon = teamGlyph(row.iconCenterX, row.centerY, TEAM_ICON_SIZE, teamColour);
      svgAttr(icon, { class: "cm-team" });
      svgAppend(visuals, icon);

      const team = svgAttr(svgCreate("text"), {
        class: "cm-team",
        x: row.textX,
        y: row.centerY,
        "font-family": FONT.family,
        "font-size": FONT.small,
        fill: teamColour,
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
        const chip = patternChipColours(spec);
        this.chip(visuals, mx, my, spec.abbreviation, chip.fill, chip.text, chip.border);
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
    const dirColor = directionLetterColour(direction);
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
      class: "cm-role-frame",
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      rx: 6,
      ry: 6,
      fill: PAPER,
      "fill-opacity": 0.96,
      stroke: MIRAGON.linie,
      "stroke-width": 1,
    });
    svgAppend(visuals, parent);

    let x = center.x - innerW / 2;
    roles.forEach((role, i) => {
      const w = widths[i];
      this.miniChip(visuals, x + w / 2, cy, w, chipH, role);
      x += w + gap;
    });
  }

  /** A fixed-size coloured sub-label inside a parent box. */
  private miniChip(
    visuals: SVGElement,
    cx: number,
    cy: number,
    w: number,
    h: number,
    text: string,
  ): void {
    const fill = markFill(text);
    const bg = svgAttr(svgCreate("rect"), {
      class: "cm-role-chip",
      x: cx - w / 2,
      y: cy - h / 2,
      width: w,
      height: h,
      rx: 3,
      ry: 3,
      fill,
      stroke: fill,
      "stroke-width": 1,
    });
    svgAppend(visuals, bg);
    const t = svgAttr(svgCreate("text"), {
      x: cx,
      y: cy,
      "font-family": FONT.family,
      "font-size": FONT.small,
      "font-weight": "700",
      fill: markTextColour(text),
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
      class: "cm-pattern-chip",
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

  // --- shared label rendering (wrapped, top-anchored) ----------------------

  /**
   * The name starts at the FIXED offset below the type header — the gap
   *  between header and name never varies with box size or line count. Lines
   *  that would run past the (fixed-size) box are dropped, the last kept line
   *  gets an ellipsis.
   */
  private appendLabel(
    visuals: SVGElement,
    text: string,
    w: number,
    h: number,
    hasTeam: boolean,
    attrs: Attrs,
  ): void {
    const fontSize =
      typeof attrs["font-size"] === "number" ? (attrs["font-size"] as number) : FONT.label;
    const fontWeight = String(attrs["font-weight"] ?? "400");
    const maxWidth = w - 20;
    let lines = wrapLabel(text, maxWidth, fontSize, fontWeight);
    const lineHeight = fontSize * 1.2;
    const available = h - CONTEXT_NAME_TOP - (hasTeam ? CONTEXT_TEAM_RESERVE : 8);
    const maxLines = Math.max(1, Math.floor(available / lineHeight));
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = ellipsize(lines[maxLines - 1], maxWidth, fontSize, fontWeight);
    }
    const startY = CONTEXT_NAME_TOP + lineHeight / 2;
    lines.forEach((ln, idx) => {
      const t = svgAttr(svgCreate("text"), {
        // `cm-name` lets the direct-editing marker hide the rendered name.
        class: "cm-name",
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

/**
 * Lucide `users` centred on (cx, cy) at `size` px, stroked in `colour` like every Lucide icon of the
 * modeler (guide §11), the same glyph the context pad's team entry shows.
 */
function teamGlyph(cx: number, cy: number, size: number, colour: string): SVGElement {
  const scale = size / 24;
  return svgAttr(svgCreate(`<g>${LUCIDE.users}</g>`), {
    transform: `translate(${cx - 12 * scale} ${cy - 12 * scale}) scale(${scale})`,
    fill: "none",
    stroke: colour,
    "stroke-width": LUCIDE_STROKE_WIDTH,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
}

function ellipsize(line: string, maxWidth: number, fontSize: number, fontWeight: string): string {
  let kept = line;
  while (kept && textWidth(`${kept}…`, fontSize, fontWeight) > maxWidth) {
    kept = kept.slice(0, -1).trimEnd();
  }
  return `${kept}…`;
}

/** Greedy word-wrap into lines that fit `maxWidth` at the font size. */
/** Explicit line breaks are the author's — wrap only within each of them. */
function wrapLabel(text: string, maxWidth: number, fontSize: number, fontWeight: string): string[] {
  const paragraphs = text.split("\n");
  if (paragraphs.every((paragraph) => paragraph.trim() === "")) return [];
  return paragraphs.flatMap((paragraph) => {
    const lines = wrapParagraph(paragraph, maxWidth, fontSize, fontWeight);
    // An intentionally blank line keeps its vertical space.
    return lines.length ? lines : [""];
  });
}

function wrapParagraph(
  text: string,
  maxWidth: number,
  fontSize: number,
  fontWeight: string,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const fits = (candidate: string) => textWidth(candidate, fontSize, fontWeight) <= maxWidth;
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (fits(candidate)) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    // A word longer than the line hard-breaks mid-word (the editor's
    // break-word behaviour), so nothing ever overflows the box.
    let rest = word;
    while (rest && !fits(rest)) {
      let low = 1;
      let high = rest.length - 1;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (fits(rest.slice(0, mid))) low = mid;
        else high = mid - 1;
      }
      lines.push(rest.slice(0, low));
      rest = rest.slice(low);
    }
    current = rest;
  }
  if (current) lines.push(current);
  return lines;
}
