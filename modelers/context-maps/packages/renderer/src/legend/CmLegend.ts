/**
 * Consolidated, collapsible notation legend (single card, bottom-left of the
 * canvas): subdomain types, integration roles (OHS/PL/ACL/CF) and the
 * relationship patterns — driven entirely by the notation spec, so it can
 * never drift from what the canvas draws. Shipped by the renderer so every
 * embedder gets it, replacing the per-host copies the reference apps carried.
 * Hovering a row shows the spelled-out explanation instantly (custom CSS
 * tooltip — a native `title` only appears after the OS hover delay).
 * Collapsed it shrinks to a button in the same corner, never disappearing.
 */

import type Canvas from "diagram-js/lib/core/Canvas";
import type EventBus from "diagram-js/lib/core/EventBus";
import {
  ALL_PATTERN_SPECS,
  ALL_SUBDOMAIN_SPECS,
  DOWNSTREAM_ROLE_SPECS,
  MARK_COLORS,
  UPSTREAM_ROLE_SPECS,
} from "@miragon/context-maps-schema-model";
import { relationshipIconSvg, subdomainIconSvg } from "../draw/palette-icons.js";

const ROLES: ReadonlyArray<{ token: string; label: string; description: string }> = [
  { token: "OHS", ...UPSTREAM_ROLE_SPECS.OHS },
  { token: "PL", ...UPSTREAM_ROLE_SPECS.PL },
  { token: "ACL", ...DOWNSTREAM_ROLE_SPECS.ACL },
  { token: "CF", ...DOWNSTREAM_ROLE_SPECS.CF },
];

function legendRow(icon: HTMLElement, label: string, explanation: string): HTMLElement {
  const row = document.createElement("div");
  row.className = "cm-legend__row cm-legend-item";
  const text = document.createElement("span");
  text.textContent = label;
  const tip = document.createElement("span");
  tip.className = "cm-legend-tip";
  tip.textContent = explanation;
  // The tip is position: fixed (anchored here) so it escapes the card's
  // scroll clipping when a small canvas forces the legend body to scroll.
  row.addEventListener("mouseenter", () => {
    const bounds = row.getBoundingClientRect();
    tip.style.left = `${bounds.right + 10}px`;
    tip.style.top = `${bounds.top + bounds.height / 2}px`;
  });
  row.append(icon, text, tip);
  return row;
}

function iconNode(svg: string): HTMLElement {
  const span = document.createElement("span");
  span.className = "cm-legend__icon";
  span.innerHTML = svg;
  return span;
}

function markNode(token: string): HTMLElement {
  const span = document.createElement("span");
  span.className = "cm-legend__mark";
  span.style.background = MARK_COLORS[token];
  span.textContent = token;
  return span;
}

function group(label: string, rows: HTMLElement[]): HTMLElement {
  const el = document.createElement("div");
  el.className = "cm-legend__group";
  el.setAttribute("aria-label", label);
  el.append(...rows);
  return el;
}

function divider(): HTMLElement {
  const el = document.createElement("div");
  el.className = "cm-legend__divider";
  return el;
}

export default class CmLegend {
  static $inject = ["canvas", "eventBus"];

  private openState = true;
  private readonly host: HTMLElement;

  constructor(canvas: Canvas, eventBus: EventBus) {
    this.host = document.createElement("div");
    canvas.getContainer().appendChild(this.host);
    this.render();
    eventBus.on("diagram.destroy", () => this.host.remove());
  }

  isOpen(): boolean {
    return this.openState;
  }

  setOpen(open: boolean): void {
    if (this.openState === open) return;
    this.openState = open;
    this.render();
  }

  toggle(): void {
    this.setOpen(!this.openState);
  }

  private render(): void {
    // The activated toggle removes itself with the re-render — hand the focus
    // to its counterpart so the keyboard path survives, but only when the
    // focus actually was inside (the initial render must not steal it).
    const hadFocus = this.host.contains(this.host.ownerDocument.activeElement);
    this.host.replaceChildren(this.openState ? this.panel() : this.collapsedButton());
    if (hadFocus) {
      this.host.querySelector<HTMLButtonElement>(".cm-legend__close, .cm-legend-toggle")?.focus();
    }
  }

  private panel(): HTMLElement {
    const box = document.createElement("div");
    box.className = "cm-legend";
    box.setAttribute("aria-label", "Legend");

    const head = document.createElement("div");
    head.className = "cm-legend__head";
    const title = document.createElement("strong");
    title.textContent = "Legend";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "cm-legend__close";
    close.setAttribute("aria-expanded", "true");
    close.setAttribute("aria-label", "Collapse legend");
    close.textContent = "–";
    close.addEventListener("click", () => this.toggle());
    head.append(title, close);

    const subdomains = group(
      "Subdomain types",
      ALL_SUBDOMAIN_SPECS.map((s) =>
        legendRow(iconNode(subdomainIconSvg(s.type)), s.label, s.description),
      ),
    );
    const roles = group(
      "Integration roles",
      ROLES.map((r) => legendRow(markNode(r.token), r.label, `${r.label} — ${r.description}`)),
    );
    const patterns = group(
      "Relationship patterns",
      ALL_PATTERN_SPECS.map((p) =>
        legendRow(
          iconNode(relationshipIconSvg(p.pattern, 18)),
          `${p.abbreviation} · ${p.label}`,
          p.description,
        ),
      ),
    );

    // Groups live in a scrollable body so a small canvas never clips the head
    // (and with it the collapse button) away.
    const body = document.createElement("div");
    body.className = "cm-legend__body";
    body.append(subdomains, divider(), roles, divider(), patterns);
    box.append(head, body);
    return box;
  }

  private collapsedButton(): HTMLElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-legend-toggle";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Show legend");
    const glyph = document.createElement("span");
    glyph.setAttribute("aria-hidden", "true");
    glyph.textContent = "▤";
    const label = document.createElement("span");
    label.textContent = "Legend";
    button.append(glyph, label);
    button.addEventListener("click", () => this.toggle());
    return button;
  }
}
