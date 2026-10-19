/**
 * The notation legend as a card of its own, for hosts without the Miragon
 * modeler shell (opt-in: `additionalModules: [cmLegendModule]`; the shell
 * renders `renderLegend` into its own legend instead). A collapsible card
 * (bottom-left of the canvas): subdomain types, integration roles (OHS/PL/ACL/CF) and the
 * relationship patterns — driven entirely by the notation spec, so it can
 * never drift from what the canvas draws. Shipped by the renderer so every
 * embedder gets it, replacing the per-host copies the reference apps carried.
 * Hovering a row shows the spelled-out explanation instantly (custom CSS
 * tooltip — a native `title` only appears after the OS hover delay).
 * Collapsed it shrinks to a button in the same corner, never disappearing.
 */

import type Canvas from "diagram-js/lib/core/Canvas";
import type EventBus from "diagram-js/lib/core/EventBus";
import { chromeIcon } from "../draw/lucide.js";
import { legendGroups, type LegendRow } from "./legendContent.js";

function legendRow(row: LegendRow): HTMLElement {
  const element = document.createElement("div");
  element.className = "cm-legend__row cm-legend-item";
  const icon = document.createElement("span");
  icon.className = "cm-legend__icon";
  icon.innerHTML = row.preview;
  const text = document.createElement("span");
  text.textContent = row.label;
  const tip = document.createElement("span");
  tip.className = "cm-legend-tip";
  tip.textContent = row.explanation;
  // The tip is position: fixed (anchored here) so it escapes the card's
  // scroll clipping when a small canvas forces the legend body to scroll.
  element.addEventListener("mouseenter", () => {
    const bounds = element.getBoundingClientRect();
    tip.style.left = `${bounds.right + 10}px`;
    tip.style.top = `${bounds.top + bounds.height / 2}px`;
  });
  element.append(icon, text, tip);
  return element;
}

function group(label: string, rows: HTMLElement[]): HTMLElement {
  const el = document.createElement("div");
  el.className = "cm-legend__group";
  el.setAttribute("role", "group");
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
    close.setAttribute("aria-label", "Close legend");
    close.innerHTML = chromeIcon("x");
    close.addEventListener("click", () => this.toggle());
    head.append(title, close);

    const groups = legendGroups().map((entry) => group(entry.label, entry.rows.map(legendRow)));
    // Groups live in a scrollable body so a small canvas never clips the head
    // (and with it the collapse button) away.
    const body = document.createElement("div");
    body.className = "cm-legend__body";
    groups.forEach((element, index) => body.append(...(index > 0 ? [divider()] : []), element));
    box.append(head, body);
    return box;
  }

  private collapsedButton(): HTMLElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-legend-toggle";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Show legend");
    button.textContent = "Legend";
    button.addEventListener("click", () => this.toggle());
    return button;
  }
}
