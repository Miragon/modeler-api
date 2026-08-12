/**
 * Consolidated, collapsible legend (single box, bottom-left) mapping the whole
 * notation: subdomain types, integration roles (OHS/PL/ACL/CF) and the
 * relationship patterns. Vanilla-DOM twin of the webapp's `Legend.tsx`.
 * Hovering any row shows the spelled-out explanation instantly (custom CSS
 * tooltip — a native `title` only appears after the OS hover delay).
 */

import {
  ALL_PATTERN_SPECS,
  ALL_SUBDOMAIN_SPECS,
  DOWNSTREAM_ROLE_SPECS,
  MARK_COLORS,
  UPSTREAM_ROLE_SPECS,
} from "@miragon/context-maps-schema-model";
import { relationshipIconSvg, subdomainIconSvg } from "./shapeIcons.js";

const ROLES: ReadonlyArray<{ token: string; label: string; description: string }> = [
  { token: "OHS", ...UPSTREAM_ROLE_SPECS.OHS },
  { token: "PL", ...UPSTREAM_ROLE_SPECS.PL },
  { token: "ACL", ...DOWNSTREAM_ROLE_SPECS.ACL },
  { token: "CF", ...DOWNSTREAM_ROLE_SPECS.CF },
];

/** One legend row: icon node + label + an instant hover explanation. */
function legendRow(icon: HTMLElement, label: string, explanation: string): HTMLElement {
  const row = document.createElement("div");
  row.className = "tt-legend__row cm-legend-item";
  const text = document.createElement("span");
  text.textContent = label;
  const tip = document.createElement("span");
  tip.className = "cm-legend-tip";
  tip.textContent = explanation;
  row.append(icon, text, tip);
  return row;
}

function iconNode(svg: string): HTMLElement {
  const span = document.createElement("span");
  span.className = "tt-legend__icon";
  span.innerHTML = svg;
  return span;
}

function markNode(token: string): HTMLElement {
  const span = document.createElement("span");
  span.className = "tt-legend__mark";
  span.style.background = MARK_COLORS[token];
  span.textContent = token;
  return span;
}

function group(label: string, rows: HTMLElement[]): HTMLElement {
  const el = document.createElement("div");
  el.className = "tt-legend__group";
  el.setAttribute("aria-label", label);
  el.append(...rows);
  return el;
}

function divider(): HTMLElement {
  const el = document.createElement("div");
  el.className = "tt-legend__divider";
  return el;
}

export function mountLegend(root: HTMLElement): void {
  let open = true;
  const host = document.createElement("div");
  root.append(host);

  const toggle = (): void => {
    open = !open;
    render();
  };

  function panel(): HTMLElement {
    const box = document.createElement("div");
    box.className = "tt-legend";
    box.setAttribute("aria-label", "Legend");

    const head = document.createElement("div");
    head.className = "tt-legend__head";
    const title = document.createElement("strong");
    title.textContent = "Legend";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "tt-legend__close";
    close.setAttribute("aria-label", "Collapse legend");
    close.textContent = "–";
    close.addEventListener("click", toggle);
    head.append(title, close);

    const subdomains = group(
      "Subdomain types",
      ALL_SUBDOMAIN_SPECS.map((s) =>
        legendRow(iconNode(subdomainIconSvg(s.type, 18)), s.label, s.description),
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

    box.append(head, subdomains, divider(), roles, divider(), patterns);
    return box;
  }

  function collapsedButton(): HTMLElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tt-iconbtn tt-legend-toggle";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Show legend");
    const glyph = document.createElement("span");
    glyph.className = "tt-iconbtn__glyph";
    glyph.setAttribute("aria-hidden", "true");
    glyph.textContent = "▤";
    const label = document.createElement("span");
    label.textContent = "Legend";
    button.append(glyph, label);
    button.addEventListener("click", toggle);
    return button;
  }

  function render(): void {
    host.replaceChildren(open ? panel() : collapsedButton());
  }

  render();
}
