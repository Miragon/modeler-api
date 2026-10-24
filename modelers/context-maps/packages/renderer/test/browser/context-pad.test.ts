import { expect, test } from "vitest";
import {
  Modeler,
  NavigatedViewer,
  isCmContext,
  isCmRelationship,
} from "@miragon/context-maps-renderer";
import type { CmContext, CmRelationship } from "@miragon/context-maps-renderer";
import { emptyDocument, type CmDocument } from "@miragon/context-maps-schema-model";

function mount(): { modeler: Modeler; container: HTMLDivElement } {
  const container = document.createElement("div");
  container.style.width = "900px";
  container.style.height = "640px";
  document.body.appendChild(container);
  return { modeler: new Modeler({ container }), container };
}

function twoContexts(): CmDocument {
  const doc = emptyDocument("m");
  doc.contexts = [
    { id: "a", label: "A", position: { x: 100, y: 200 }, size: { width: 200, height: 110 } },
    { id: "b", label: "B", position: { x: 600, y: 200 }, size: { width: 200, height: 110 } },
  ];
  return doc;
}

function connectedContexts(pattern: CmRelationship["pattern"]): CmDocument {
  const doc = twoContexts();
  doc.relationships = [{ id: "r", from: "a", to: "b", pattern }];
  return doc;
}

function padActions(container: HTMLElement): string[] {
  return [...container.querySelectorAll(".djs-context-pad.open .entry")].map(
    (entry) => entry.getAttribute("data-action") ?? "",
  );
}

function clickPadEntry(container: HTMLElement, action: string): void {
  const entry = container.querySelector(`.djs-context-pad.open [data-action="${action}"]`);
  expect(entry, `pad entry "${action}"`).not.toBeNull();
  entry!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
}

function clickMenuEntry(id: string): void {
  const entry = document.querySelector(`.djs-popup [data-id="${id}"]`);
  expect(entry, `popup entry "${id}"`).not.toBeNull();
  entry!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
}

test("selecting a bounded context shows the quick-action pad", () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(twoContexts());
    const registry = modeler.get<{ getAll(): unknown[] }>("elementRegistry");
    const selection = modeler.get<{ select(el: unknown): void }>("selection");
    const [a] = registry.getAll().filter(isCmContext);

    expect(container.querySelector(".djs-context-pad.open")).toBeNull();

    selection.select(a);
    const pad = container.querySelector(".djs-context-pad.open");
    expect(pad).not.toBeNull();
    expect(padActions(container)).toEqual([
      "append-context",
      "connect",
      "subdomain-type",
      "team",
      "edit-label",
      "description",
      "delete",
    ]);

    selection.select(null);
    expect(container.querySelector(".djs-context-pad.open")).toBeNull();
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("the pad stacks its actions vertically as individual cards", () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(twoContexts());
    const registry = modeler.get<{ getAll(): unknown[] }>("elementRegistry");
    const selection = modeler.get<{ select(el: unknown): void }>("selection");
    const [a] = registry.getAll().filter(isCmContext);
    selection.select(a);

    const entries = [...container.querySelectorAll(".djs-context-pad.open .entry.cm-pad-entry")];
    expect(entries.length).toBeGreaterThan(2);
    const boxes = entries.map((entry) => entry.getBoundingClientRect());
    for (let index = 1; index < boxes.length; index += 1) {
      expect(boxes[index].top).toBeGreaterThanOrEqual(boxes[index - 1].bottom);
      expect(Math.abs(boxes[index].left - boxes[0].left)).toBeLessThan(1);
    }
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("the subdomain-type menu classifies the context through the command stack", () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(twoContexts());
    const registry = modeler.get<{ getAll(): unknown[] }>("elementRegistry");
    const selection = modeler.get<{ select(el: unknown): void }>("selection");
    const [a] = registry.getAll().filter(isCmContext) as CmContext[];

    selection.select(a);
    clickPadEntry(container, "subdomain-type");

    const popup = document.querySelector(".djs-popup");
    expect(popup).not.toBeNull();
    expect(popup!.querySelector(".djs-popup-title")?.textContent).toBe("Subdomain type");
    // three types + "Unclassified", which reflects the current (unset) state
    expect(popup!.querySelectorAll("[data-id]")).toHaveLength(4);
    expect(
      popup!
        .querySelector('[data-id="type-none"] .djs-popup-entry-name')
        ?.classList.contains("cm-popup-active"),
    ).toBe(true);

    clickMenuEntry("type-generic");
    expect(document.querySelector(".djs-popup")).toBeNull();
    expect(a.subdomainType).toBe("generic");
    expect(modeler.exportDocument().contexts.find((c) => c.id === "a")?.subdomainType).toBe(
      "generic",
    );

    // the pad's type icon action stays, and the menu now marks the new state
    clickPadEntry(container, "subdomain-type");
    expect(
      document
        .querySelector('.djs-popup [data-id="type-generic"] .djs-popup-entry-name')
        ?.classList.contains("cm-popup-active"),
    ).toBe(true);
    modeler.get<{ close(): void }>("popupMenu").close();

    modeler.undo();
    expect(a.subdomainType).toBeUndefined();
    modeler.redo();
    expect(a.subdomainType).toBe("generic");
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("selecting a relationship offers pattern, roles, swap, rename and delete", () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(connectedContexts("upstream-downstream"));
    const registry = modeler.get<{ getAll(): unknown[] }>("elementRegistry");
    const selection = modeler.get<{ select(el: unknown): void }>("selection");
    const [relationship] = registry.getAll().filter(isCmRelationship);

    selection.select(relationship);
    const pad = container.querySelector(".djs-context-pad.open");
    expect(pad).not.toBeNull();
    expect(padActions(container)).toEqual([
      "pattern",
      "roles",
      "swap-ends",
      "edit-label",
      "description",
      "delete",
    ]);
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("the pattern menu switches the pattern and prunes direction-only actions", () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(connectedContexts("upstream-downstream"));
    const registry = modeler.get<{ getAll(): unknown[] }>("elementRegistry");
    const selection = modeler.get<{ select(el: unknown): void }>("selection");
    const [relationship] = registry.getAll().filter(isCmRelationship) as CmRelationship[];
    relationship.upstreamRoles = ["OHS"];

    selection.select(relationship);
    clickPadEntry(container, "pattern");

    const popup = document.querySelector(".djs-popup");
    expect(popup).not.toBeNull();
    expect(popup!.querySelector(".djs-popup-title")?.textContent).toBe("Relationship pattern");
    expect(popup!.querySelectorAll("[data-id]")).toHaveLength(5);
    expect(
      popup!
        .querySelector('[data-id="pattern-upstream-downstream"] .djs-popup-entry-name')
        ?.classList.contains("cm-popup-active"),
    ).toBe(true);

    clickMenuEntry("pattern-partnership");
    expect(relationship.pattern).toBe("partnership");
    // symmetric patterns carry no roles and no direction actions
    expect(relationship.upstreamRoles).toBeUndefined();
    expect(padActions(container)).toEqual(["pattern", "edit-label", "description", "delete"]);
    expect(modeler.exportDocument().relationships[0].pattern).toBe("partnership");

    modeler.undo();
    expect(relationship.pattern).toBe("upstream-downstream");
    expect(relationship.upstreamRoles).toEqual(["OHS"]);
    expect(padActions(container)).toEqual([
      "pattern",
      "roles",
      "swap-ends",
      "edit-label",
      "description",
      "delete",
    ]);
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("the roles menu toggles upstream roles and keeps downstream roles exclusive", () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(connectedContexts("upstream-downstream"));
    const registry = modeler.get<{ getAll(): unknown[] }>("elementRegistry");
    const selection = modeler.get<{ select(el: unknown): void }>("selection");
    const [relationship] = registry.getAll().filter(isCmRelationship) as CmRelationship[];

    selection.select(relationship);
    clickPadEntry(container, "roles");
    const popup = document.querySelector(".djs-popup");
    expect(popup!.querySelector(".djs-popup-title")?.textContent).toBe("Integration roles");
    expect(popup!.querySelectorAll("[data-id]")).toHaveLength(4);

    clickMenuEntry("upstream-OHS");
    expect(relationship.upstreamRoles).toEqual(["OHS"]);

    // the multi-select menu survives the toggle (re-opened in place) and now
    // marks the fresh state, so roles can be combined without re-opening the pad
    expect(
      document
        .querySelector('.djs-popup [data-id="upstream-OHS"] .djs-popup-entry-name')
        ?.classList.contains("cm-popup-active"),
    ).toBe(true);
    clickMenuEntry("upstream-PL");
    expect(relationship.upstreamRoles).toEqual(["OHS", "PL"]);

    clickMenuEntry("downstream-ACL");
    expect(relationship.downstreamRoles).toEqual(["ACL"]);

    // picking the other downstream role replaces (ACL and CF exclude each other)
    clickMenuEntry("downstream-CF");
    expect(relationship.downstreamRoles).toEqual(["CF"]);

    // toggling an active role off again
    clickMenuEntry("downstream-CF");
    expect(relationship.downstreamRoles).toBeUndefined();

    modeler.undo();
    expect(relationship.downstreamRoles).toEqual(["CF"]);
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("customer-supplier blocks OHS and CF in the roles menu", () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(connectedContexts("customer-supplier"));
    const registry = modeler.get<{ getAll(): unknown[] }>("elementRegistry");
    const selection = modeler.get<{ select(el: unknown): void }>("selection");
    const [relationship] = registry.getAll().filter(isCmRelationship) as CmRelationship[];

    selection.select(relationship);
    clickPadEntry(container, "roles");

    const ohs = document.querySelector('.djs-popup [data-id="upstream-OHS"]');
    const cf = document.querySelector('.djs-popup [data-id="downstream-CF"]');
    expect(ohs?.classList.contains("disabled")).toBe(true);
    expect(cf?.classList.contains("disabled")).toBe(true);

    clickMenuEntry("upstream-OHS");
    expect(relationship.upstreamRoles).toBeUndefined();

    clickMenuEntry("upstream-PL");
    expect(relationship.upstreamRoles).toEqual(["PL"]);
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("an imported rule-violating role stays deselectable under customer-supplier", () => {
  const { modeler, container } = mount();
  try {
    const doc = connectedContexts("customer-supplier");
    doc.relationships[0].upstreamRoles = ["OHS"];
    doc.relationships[0].downstreamRoles = ["CF"];
    modeler.importDocument(doc);
    const registry = modeler.get<{ getAll(): unknown[] }>("elementRegistry");
    const selection = modeler.get<{ select(el: unknown): void }>("selection");
    const [relationship] = registry.getAll().filter(isCmRelationship) as CmRelationship[];

    selection.select(relationship);
    clickPadEntry(container, "roles");

    // deselecting the violating role is the repair — it must not be locked out
    const ohs = document.querySelector('.djs-popup [data-id="upstream-OHS"]');
    expect(ohs?.classList.contains("disabled")).toBe(false);
    expect(ohs?.querySelector(".djs-popup-entry-name")?.classList.contains("cm-popup-active")).toBe(
      true,
    );
    clickMenuEntry("upstream-OHS");
    expect(relationship.upstreamRoles).toBeUndefined();

    clickMenuEntry("downstream-CF");
    expect(relationship.downstreamRoles).toBeUndefined();

    // once removed, the customer-supplier blockers apply again
    const ohsAfter = document.querySelector('.djs-popup [data-id="upstream-OHS"]');
    expect(ohsAfter?.classList.contains("disabled")).toBe(true);
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("a relationship with an unknown pattern still gets a working pad", () => {
  const { modeler, container } = mount();
  try {
    const doc = twoContexts();
    doc.relationships = [
      { id: "r", from: "a", to: "b", pattern: "conformist" as CmRelationship["pattern"] },
    ];
    modeler.importDocument(doc);
    const registry = modeler.get<{ getAll(): unknown[] }>("elementRegistry");
    const selection = modeler.get<{ select(el: unknown): void }>("selection");
    const [relationship] = registry.getAll().filter(isCmRelationship) as CmRelationship[];

    selection.select(relationship);
    // no direction-only actions for an unknown pattern, but the pattern menu
    // stays available to repair the element
    expect(padActions(container)).toEqual(["pattern", "edit-label", "description", "delete"]);

    clickPadEntry(container, "pattern");
    clickMenuEntry("pattern-upstream-downstream");
    expect(relationship.pattern).toBe("upstream-downstream");
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("the pad is clamped back into view at the right canvas edge", async () => {
  const { modeler, container } = mount();
  try {
    const doc = emptyDocument("m");
    doc.contexts = [
      { id: "a", label: "A", position: { x: 0, y: 0 }, size: { width: 200, height: 110 } },
    ];
    modeler.importDocument(doc);
    const registry = modeler.get<{ getAll(): unknown[] }>("elementRegistry");
    const selection = modeler.get<{ select(el: unknown): void }>("selection");
    const canvas = modeler.get<{ viewbox(box?: object): unknown; getContainer(): HTMLElement }>(
      "canvas",
    );
    const [a] = registry.getAll().filter(isCmContext);

    // scale-1 viewbox putting the shape's right edge 10px short of the right
    // border: the pad (anchored 8px right of the shape) would overflow and be
    // clipped by the container's overflow: hidden
    const inner = canvas.getContainer().getBoundingClientRect();
    canvas.viewbox({ x: 210 - inner.width, y: -20, width: inner.width, height: inner.height });
    selection.select(a);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const pad = container.querySelector<HTMLElement>(".djs-context-pad.open");
    expect(pad).not.toBeNull();
    const padBounds = pad!.getBoundingClientRect();
    expect(padBounds.width).toBeGreaterThan(0);
    expect(padBounds.right).toBeLessThanOrEqual(inner.right);
    expect(padBounds.left).toBeGreaterThanOrEqual(inner.left);
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("a flipped connection pad is clamped back in at the left canvas edge", async () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(connectedContexts("upstream-downstream"));
    const registry = modeler.get<{ getAll(): unknown[] }>("elementRegistry");
    const selection = modeler.get<{ select(el: unknown): void }>("selection");
    const canvas = modeler.get<{ viewbox(box?: object): unknown; getContainer(): HTMLElement }>(
      "canvas",
    );
    const [relationship] = registry.getAll().filter(isCmRelationship);

    // the pad anchor (the last waypoint, on the target's left edge at x=600)
    // lands 10px inside the left border — the flip-x transform would carry
    // the whole stack outside the container
    const inner = canvas.getContainer().getBoundingClientRect();
    canvas.viewbox({ x: 590, y: 150, width: inner.width, height: inner.height });
    selection.select(relationship);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const pad = container.querySelector<HTMLElement>(".djs-context-pad.open");
    expect(pad).not.toBeNull();
    expect(pad!.classList.contains("cm-pad-flip-x")).toBe(true);
    const padBounds = pad!.getBoundingClientRect();
    expect(padBounds.width).toBeGreaterThan(0);
    expect(padBounds.left).toBeGreaterThanOrEqual(inner.left);
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("popup menus open beside their pad entry and dodge the pad at the right edge", async () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(twoContexts());
    const registry = modeler.get<{ getAll(): unknown[] }>("elementRegistry");
    const selection = modeler.get<{ select(el: unknown): void }>("selection");
    const canvas = modeler.get<{ viewbox(box?: object): unknown; getContainer(): HTMLElement }>(
      "canvas",
    );
    const [a] = registry.getAll().filter(isCmContext);
    const inner = canvas.getContainer().getBoundingClientRect();
    const documentWidth = document.documentElement.getBoundingClientRect().width;

    // room to the right: the menu opens beside the entry, top-aligned
    canvas.viewbox({ x: 292, y: 150, width: inner.width, height: inner.height });
    selection.select(a);
    await new Promise((resolve) => setTimeout(resolve, 60));
    const entry = container.querySelector('.djs-context-pad.open [data-action="subdomain-type"]');
    const entryBounds = entry!.getBoundingClientRect();
    clickPadEntry(container, "subdomain-type");
    const besideBounds = document.querySelector(".djs-popup")!.getBoundingClientRect();
    expect(besideBounds.left).toBeGreaterThanOrEqual(entryBounds.right);
    expect(Math.abs(besideBounds.top - entryBounds.top)).toBeLessThanOrEqual(6);

    // at the right edge PopupMenu flips the menu back across its anchor — it
    // must end up fully left of the pad column, not on top of it
    selection.select(null);
    canvas.viewbox({
      x: 300 + inner.left + 10 - documentWidth,
      y: 150,
      width: inner.width,
      height: inner.height,
    });
    selection.select(a);
    await new Promise((resolve) => setTimeout(resolve, 60));
    const pad = container.querySelector<HTMLElement>(".djs-context-pad.open");
    const padBounds = pad!.getBoundingClientRect();
    clickPadEntry(container, "subdomain-type");
    const flippedBounds = document.querySelector(".djs-popup")!.getBoundingClientRect();
    expect(flippedBounds.right).toBeLessThanOrEqual(padBounds.left + 0.5);
    modeler.get<{ close(): void }>("popupMenu").close();
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("a connection closing rightward flips its pad clear of the target context", () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(connectedContexts("upstream-downstream"));
    const registry = modeler.get<{ getAll(): unknown[] }>("elementRegistry");
    const selection = modeler.get<{ select(el: unknown): void }>("selection");
    const [relationship] = registry.getAll().filter(isCmRelationship);

    selection.select(relationship);
    const pad = container.querySelector(".djs-context-pad.open");
    expect(pad!.classList.contains("cm-pad-flip-x")).toBe(true);
    expect(pad!.classList.contains("cm-pad-flip-y")).toBe(false);
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("the delete action removes the element through the command stack", () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(connectedContexts("partnership"));
    const registry = modeler.get<{ getAll(): unknown[] }>("elementRegistry");
    const selection = modeler.get<{ select(el: unknown): void }>("selection");
    const [relationship] = registry.getAll().filter(isCmRelationship);

    selection.select(relationship);
    clickPadEntry(container, "delete");
    expect(modeler.exportDocument().relationships).toHaveLength(0);

    modeler.undo();
    expect(modeler.exportDocument().relationships).toHaveLength(1);
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("the connect action draws a relationship from the pad", () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(twoContexts());
    const registry = modeler.get<{ getAll(): unknown[] }>("elementRegistry");
    const selection = modeler.get<{ select(el: unknown): void }>("selection");
    const canvas = modeler.get<{ getGraphics(el: unknown): SVGElement }>("canvas");
    const eventBus = modeler.get<{ createEvent(data: unknown): Event }>("eventBus");
    const dragging = modeler.get<{
      hover(event: Event): void;
      move(event: Event): void;
      end(): void;
    }>("dragging");
    const [a, b] = registry.getAll().filter(isCmContext);

    selection.select(a);
    clickPadEntry(container, "connect");
    dragging.move(
      eventBus.createEvent({ x: 500, y: 255, clientX: 500, clientY: 255 }) as unknown as Event,
    );
    dragging.hover(
      eventBus.createEvent({ element: b, gfx: canvas.getGraphics(b) }) as unknown as Event,
    );
    dragging.move(
      eventBus.createEvent({ x: 700, y: 255, clientX: 700, clientY: 255 }) as unknown as Event,
    );
    dragging.end();

    const exported = modeler.exportDocument();
    expect(exported.relationships).toHaveLength(1);
    expect(exported.relationships[0]).toMatchObject({ from: "a", to: "b" });
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("the append action creates a connected blank context and offers its type", async () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(twoContexts());
    const registry = modeler.get<{ getAll(): unknown[] }>("elementRegistry");
    const selection = modeler.get<{ select(el: unknown): void; get(): unknown[] }>("selection");
    const [a] = registry.getAll().filter(isCmContext) as CmContext[];

    selection.select(a);
    clickPadEntry(container, "append-context");

    const exported = modeler.exportDocument();
    expect(exported.contexts).toHaveLength(3);
    expect(exported.relationships).toHaveLength(1);
    const appended = exported.contexts.find((c) => c.id !== "a" && c.id !== "b")!;
    // blank by default — classifying happens via the menu that opens next
    expect(appended.subdomainType).toBeUndefined();
    expect(exported.relationships[0]).toMatchObject({ from: "a", to: appended.id });

    // the new context is selected and the subdomain-type menu opens on it
    const selected = selection.get().filter(isCmContext) as CmContext[];
    expect(selected).toHaveLength(1);
    expect(selected[0].id).toBe(appended.id);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const popup = document.querySelector(".djs-popup");
    expect(popup).not.toBeNull();
    expect(popup!.querySelector(".djs-popup-title")?.textContent).toBe("Subdomain type");

    clickMenuEntry("type-core");
    expect(modeler.exportDocument().contexts.find((c) => c.id === appended.id)?.subdomainType).toBe(
      "core",
    );

    // one undo for the classification, one for the whole append (shape + line)
    modeler.undo();
    modeler.undo();
    expect(modeler.exportDocument().contexts).toHaveLength(2);
    expect(modeler.exportDocument().relationships).toHaveLength(0);
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("a multi-selection gets a single delete action", () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(twoContexts());
    const registry = modeler.get<{ getAll(): unknown[] }>("elementRegistry");
    const selection = modeler.get<{ select(el: unknown): void }>("selection");
    const contexts = registry.getAll().filter(isCmContext);

    selection.select(contexts);
    expect(padActions(container)).toEqual(["delete"]);

    clickPadEntry(container, "delete");
    expect(modeler.exportDocument().contexts).toHaveLength(0);

    modeler.undo();
    expect(modeler.exportDocument().contexts).toHaveLength(2);
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("the team action edits the caption in place at the box bottom", () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(twoContexts());
    const registry = modeler.get<{ getAll(): unknown[] }>("elementRegistry");
    const selection = modeler.get<{ select(el: unknown): void }>("selection");
    const canvas = modeler.get<{
      getGraphics(el: unknown): SVGElement;
      getAbsoluteBBox(el: unknown): { y: number; height: number };
    }>("canvas");
    const [a] = registry.getAll().filter(isCmContext) as CmContext[];

    selection.select(a);
    clickPadEntry(container, "team");

    // the edit box sits over the caption band at the BOTTOM of the box
    const parent = container.querySelector<HTMLElement>(".djs-direct-editing-parent");
    expect(parent).not.toBeNull();
    const bbox = canvas.getAbsoluteBBox(a);
    const boxTop = parseFloat(parent!.style.top);
    expect(boxTop).toBeGreaterThan(bbox.y + bbox.height / 2);
    expect(canvas.getGraphics(a).classList.contains("cm-direct-editing-team")).toBe(true);

    const content = container.querySelector<HTMLElement>(".djs-direct-editing-content")!;
    content.innerText = "Team Payments";
    modeler.get<{ complete(): void }>("directEditing").complete();
    expect(a.team).toBe("Team Payments");
    expect(modeler.exportDocument().contexts.find((c) => c.id === "a")?.team).toBe("Team Payments");
    expect(canvas.getGraphics(a).classList.contains("cm-direct-editing-team")).toBe(false);

    modeler.undo();
    expect(a.team).toBeUndefined();
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("explicit line breaks from direct editing survive into the rendered name", () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(twoContexts());
    const registry = modeler.get<{ getAll(): unknown[] }>("elementRegistry");
    const selection = modeler.get<{ select(el: unknown): void }>("selection");
    const canvas = modeler.get<{ getGraphics(el: unknown): SVGElement }>("canvas");
    const [a] = registry.getAll().filter(isCmContext) as CmContext[];

    selection.select(a);
    clickPadEntry(container, "edit-label");
    const content = container.querySelector<HTMLElement>(".djs-direct-editing-content")!;
    content.innerText = "Billing\nand Dunning";
    modeler.get<{ complete(): void }>("directEditing").complete();

    expect(a.cmLabel).toBe("Billing\nand Dunning");
    const lines = [...canvas.getGraphics(a).querySelectorAll("text.cm-name")].map(
      (node) => node.textContent,
    );
    expect(lines).toEqual(["Billing", "and Dunning"]);
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("the description action edits contexts and relationships via the prompt", () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(connectedContexts("upstream-downstream"));
    const registry = modeler.get<{ getAll(): unknown[] }>("elementRegistry");
    const selection = modeler.get<{ select(el: unknown): void }>("selection");
    const [a] = registry.getAll().filter(isCmContext) as CmContext[];
    const [relationship] = registry.getAll().filter(isCmRelationship) as CmRelationship[];

    selection.select(a);
    clickPadEntry(container, "description");
    const area = container.querySelector<HTMLTextAreaElement>(
      ".cm-pad-prompt textarea.cm-pad-prompt__field",
    );
    expect(area).not.toBeNull();
    area!.value = "Handles all invoicing.";
    area!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }),
    );
    expect(a.description).toBe("Handles all invoicing.");
    expect(modeler.exportDocument().contexts.find((c) => c.id === "a")?.description).toBe(
      "Handles all invoicing.",
    );

    selection.select(relationship);
    clickPadEntry(container, "description");
    const relArea = container.querySelector<HTMLTextAreaElement>(
      ".cm-pad-prompt textarea.cm-pad-prompt__field",
    )!;
    relArea.value = "Invoices flow downstream.";
    relArea.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }),
    );
    expect(relationship.description).toBe("Invoices flow downstream.");

    // Escape discards without committing
    selection.select(a);
    clickPadEntry(container, "description");
    const again = container.querySelector<HTMLTextAreaElement>(
      ".cm-pad-prompt textarea.cm-pad-prompt__field",
    )!;
    again.value = "Discarded";
    again.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(container.querySelector(".cm-pad-prompt")).toBeNull();
    expect(a.description).toBe("Handles all invoicing.");

    modeler.undo();
    expect(relationship.description).toBeUndefined();
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("the rename action edits the name in place (direct editing)", () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(twoContexts());
    const registry = modeler.get<{ getAll(): unknown[] }>("elementRegistry");
    const selection = modeler.get<{ select(el: unknown): void }>("selection");
    const canvas = modeler.get<{ getGraphics(el: unknown): SVGElement }>("canvas");
    const [a] = registry.getAll().filter(isCmContext) as CmContext[];

    selection.select(a);
    clickPadEntry(container, "edit-label");

    // the contenteditable box sits inside the canvas, the rendered name hides
    const content = container.querySelector<HTMLElement>(".djs-direct-editing-content");
    expect(content).not.toBeNull();
    expect(content!.getAttribute("contenteditable")).toBe("true");
    expect(canvas.getGraphics(a).classList.contains("cm-direct-editing")).toBe(true);

    content!.innerText = "Billing";
    modeler.get<{ complete(): void }>("directEditing").complete();
    expect(a.cmLabel).toBe("Billing");
    expect(container.querySelector(".djs-direct-editing-content")).toBeNull();
    expect(canvas.getGraphics(a).classList.contains("cm-direct-editing")).toBe(false);
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("double-click activates in-place editing and Escape cancels without a command", () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(twoContexts());
    const registry = modeler.get<{ getAll(): unknown[] }>("elementRegistry");
    const eventBus = modeler.get<{ fire(name: string, data: unknown): void }>("eventBus");
    const [a] = registry.getAll().filter(isCmContext) as CmContext[];

    eventBus.fire("element.dblclick", { element: a });
    const content = container.querySelector<HTMLElement>(".djs-direct-editing-content");
    expect(content).not.toBeNull();

    content!.innerText = "Discarded";
    modeler.get<{ cancel(): void }>("directEditing").cancel();
    expect(container.querySelector(".djs-direct-editing-content")).toBeNull();
    expect(a.cmLabel).toBe("A");
    expect(modeler.canUndo()).toBe(false);
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("viewers stay pad-free", () => {
  const container = document.createElement("div");
  container.style.width = "900px";
  container.style.height = "640px";
  document.body.appendChild(container);
  const viewer = new NavigatedViewer({ container });
  try {
    viewer.importDocument(twoContexts());
    const registry = viewer.get<{ getAll(): unknown[] }>("elementRegistry");
    const selection = viewer.get<{ select(el: unknown): void }>("selection");
    const [a] = registry.getAll().filter(isCmContext);

    selection.select(a);
    expect(container.querySelector(".djs-context-pad")).toBeNull();
    expect(() => viewer.get("contextPad")).toThrow();
  } finally {
    viewer.destroy();
    container.remove();
  }
});
