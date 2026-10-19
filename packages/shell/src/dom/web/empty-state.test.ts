import { afterEach, describe, expect, it } from "vitest";

import { defaultMessages } from "../../core/index.js";
import type { EmptyStateOptions } from "../types.js";
import { createEmptyState } from "./empty-state.js";

afterEach(() => {
  document.body.replaceChildren();
});

const KOMET = "/miragon-komet-blau.svg";

function emptyState(
  options: Partial<EmptyStateOptions> = {},
  { dropHint }: { dropHint: string | undefined } = { dropHint: "Or drop a file here" },
) {
  const calls: string[] = [];
  const card = createEmptyState({
    ownerDocument: document,
    messages: defaultMessages,
    options: {
      title: "Event Storming Modeler",
      text: "Start a new diagram, or explore the example.",
      komet: KOMET,
      onNewDiagram: () => calls.push("new-diagram"),
      onShowExample: () => calls.push("show-example"),
      ...options,
    },
    dropHint,
    titleId: "cd-shell-empty-state-title-1",
    onLeave: () => calls.push("leave"),
  });
  document.body.append(card.element);
  return { card, calls };
}

function buttons(element: HTMLElement): HTMLButtonElement[] {
  return [...element.querySelectorAll("button")];
}

describe("empty state (guide §8)", () => {
  it("is a section named by its h1 and hidden until shown", () => {
    const { card } = emptyState();
    const section = card.element;
    expect(section.tagName).toBe("SECTION");
    expect(section.className).toBe("cd-shell-empty-state");
    expect(section.getAttribute("data-chrome")).toBe("empty-state");
    expect(section.getAttribute("aria-labelledby")).toBe("cd-shell-empty-state-title-1");
    expect(section.querySelector("h1")?.id).toBe("cd-shell-empty-state-title-1");
    expect(section.hidden).toBe(true);
    expect(card.isShown()).toBe(false);
  });

  it("holds the Komet, title, help, the two buttons and the drop hint, in this order", () => {
    const { card } = emptyState();
    const [mark, title, text, actions, hint] = [...card.element.children];
    expect(mark?.tagName).toBe("IMG");
    expect(mark?.className).toBe("cd-shell-empty-state-mark");
    expect(mark?.getAttribute("src")).toBe(KOMET);
    expect(mark?.getAttribute("width")).toBe("64");
    expect(mark?.getAttribute("height")).toBe("64");
    expect(mark?.getAttribute("alt")).toBe("");
    expect(mark?.getAttribute("draggable")).toBe("false");
    expect(title?.tagName).toBe("H1");
    expect(title?.className).toBe("cd-shell-empty-state-title");
    expect(title?.textContent).toBe("Event Storming Modeler");
    expect(text?.className).toBe("cd-shell-empty-state-text");
    expect(text?.textContent).toBe("Start a new diagram, or explore the example.");
    expect(actions?.className).toBe("cd-shell-empty-state-actions");
    expect(hint?.className).toBe("cd-shell-empty-state-hint");
    expect(hint?.textContent).toBe("Or drop a file here");
    expect(card.element.children).toHaveLength(5);
  });

  it("puts the blue New diagram before the ghost Show example", () => {
    const { card } = emptyState();
    expect(
      buttons(card.element).map((button) => ({
        type: button.getAttribute("type"),
        className: button.className,
        variant: button.getAttribute("data-variant"),
        label: button.textContent,
      })),
    ).toEqual([
      { type: "button", className: "cd-shell-button", variant: "primary", label: "New diagram" },
      { type: "button", className: "cd-shell-button", variant: "ghost", label: "Show example" },
    ]);
  });

  it("leaves the start screen before it runs a button's handler", () => {
    const { card, calls } = emptyState();
    const [newDiagram, showExample] = buttons(card.element);
    newDiagram?.click();
    showExample?.click();
    expect(calls).toEqual(["leave", "new-diagram", "leave", "show-example"]);
  });

  it("has no Show example without onShowExample", () => {
    const { card } = emptyState({ onShowExample: undefined });
    expect(buttons(card.element).map((button) => button.textContent)).toEqual(["New diagram"]);
  });

  it("shows the drop hint only with a drop zone", () => {
    const withoutDropZone = emptyState({}, { dropHint: undefined });
    expect(withoutDropZone.card.element.querySelector(".cd-shell-empty-state-hint")).toBeNull();
    expect(
      emptyState({}, { dropHint: "Or drop a .storm file" }).card.element.querySelector(
        ".cd-shell-empty-state-hint",
      )?.textContent,
    ).toBe("Or drop a .storm file");
  });

  it("shows, hides and removes itself", () => {
    const { card } = emptyState();
    card.setShown(true);
    expect(card.isShown()).toBe(true);
    expect(card.element.hidden).toBe(false);
    card.setShown(false);
    expect(card.isShown()).toBe(false);
    card.destroy();
    expect(card.element.isConnected).toBe(false);
  });
});
