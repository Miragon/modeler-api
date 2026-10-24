import { expect, test } from "vitest";
import { Modeler, isCmContext } from "@miragon/context-maps-renderer";
import type { CmContext, CmLabelEditing } from "@miragon/context-maps-renderer";
import { emptyDocument, type CmDocument } from "@miragon/context-maps-schema-model";

interface CanvasLike {
  viewbox(box?: { x: number; y: number; width: number; height: number }): {
    x: number;
    y: number;
    scale: number;
  };
  zoom(): number;
  scroll(delta: { dx: number; dy: number }): void;
  getAbsoluteBBox(element: unknown): { x: number; y: number; width: number; height: number };
}

function mount(): { modeler: Modeler; container: HTMLDivElement } {
  const container = document.createElement("div");
  container.style.width = "900px";
  container.style.height = "640px";
  document.body.appendChild(container);
  return { modeler: new Modeler({ container, width: 900, height: 640 }), container };
}

function twoContexts(): CmDocument {
  const doc = emptyDocument("m");
  doc.contexts = [
    { id: "a", label: "A", position: { x: 100, y: 200 }, size: { width: 200, height: 110 } },
    { id: "b", label: "B", position: { x: 600, y: 200 }, size: { width: 200, height: 110 } },
  ];
  return doc;
}

function contextA(modeler: Modeler): CmContext {
  const registry = modeler.get<{ getAll(): unknown[] }>("elementRegistry");
  return registry
    .getAll()
    .filter(isCmContext)
    .find((context) => context.id === "a")!;
}

function countChanges(modeler: Modeler): () => number {
  let changes = 0;
  modeler.on("commandStack.changed", () => (changes += 1));
  return () => changes;
}

/** diagram-js schedules pad updates and the focus restore in later tasks; let them run. */
const scheduledWork = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20));

test("a view change keeps the label editor open with its text and moves it with the element", async () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(twoContexts());
    const changes = countChanges(modeler);
    const before = modeler.exportText();
    const canvas = modeler.get<CanvasLike>("canvas");
    const labelEditing = modeler.get<CmLabelEditing>("cmLabelEditing");
    const a = contextA(modeler);

    labelEditing.activate(a);
    const content = container.querySelector<HTMLElement>(".djs-direct-editing-content")!;
    const box = container.querySelector<HTMLElement>(".djs-direct-editing-parent")!;
    content.innerText = "Billing, half typed";
    const leftBefore = box.style.left;
    const zoomBefore = canvas.zoom();
    const fontSizeBefore = parseFloat(content.style.fontSize);

    canvas.viewbox({ x: 40, y: 140, width: 450, height: 320 });

    expect(changes()).toBe(0);
    expect(modeler.exportText()).toBe(before);
    expect(labelEditing.openEdit()).toEqual({ elementId: "a", text: "Billing, half typed" });
    expect(container.querySelector(".djs-direct-editing-content")).toBe(content);
    const zoom = canvas.zoom();
    const bbox = canvas.getAbsoluteBBox(a);
    expect(box.style.left).not.toBe(leftBefore);
    expect(parseFloat(box.style.left)).toBeCloseTo(bbox.x + 10 * zoom, 1);
    expect(parseFloat(box.style.width)).toBeCloseTo(bbox.width - 20 * zoom, 1);
    expect(zoom).not.toBeCloseTo(zoomBefore, 2);
    expect(parseFloat(content.style.fontSize)).toBeCloseTo((fontSizeBefore * zoom) / zoomBefore, 1);

    content.dispatchEvent(new KeyboardEvent("keydown", { keyCode: 13, bubbles: true }));
    expect(a.cmLabel).toBe("Billing, half typed");
    expect(changes()).toBe(1);
    await scheduledWork();
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("starting a drag still completes the open label editor", async () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(twoContexts());
    const a = contextA(modeler);
    modeler.get<CmLabelEditing>("cmLabelEditing").activate(a);
    container.querySelector<HTMLElement>(".djs-direct-editing-content")!.innerText = "Dragged";

    modeler.get<{ fire(name: string, data?: unknown): void }>("eventBus").fire("drag.init", {});

    expect(a.cmLabel).toBe("Dragged");
    expect(container.querySelector(".djs-direct-editing-content")).toBeNull();
    await scheduledWork();
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("a view change keeps the description prompt open with its text, beside its pad entry", async () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(twoContexts());
    const changes = countChanges(modeler);
    const canvas = modeler.get<CanvasLike>("canvas");
    const a = contextA(modeler);
    modeler.get<{ select(element: unknown): void }>("selection").select(a);
    await scheduledWork();
    container
      .querySelector(`.djs-context-pad.open [data-action="description"]`)!
      .dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    const card = container.querySelector<HTMLElement>(".cm-pad-prompt")!;
    const field = card.querySelector<HTMLTextAreaElement>("textarea")!;
    field.value = "Handles invoicing, half typed";
    const entryOf = (): DOMRect =>
      container
        .querySelector(`.djs-context-pad.open [data-action="description"]`)!
        .getBoundingClientRect();
    const entryBefore = entryOf();
    const cardBefore = card.getBoundingClientRect();

    canvas.scroll({ dx: 120, dy: -40 });
    await scheduledWork();

    expect(changes()).toBe(0);
    expect(a.description).toBeUndefined();
    expect(card.isConnected).toBe(true);
    expect(field.value).toBe("Handles invoicing, half typed");
    expect(document.activeElement).toBe(field);
    const entryAfter = entryOf();
    const cardAfter = card.getBoundingClientRect();
    expect(entryAfter.left - entryBefore.left).toBeCloseTo(120, 0);
    expect(cardAfter.left - cardBefore.left).toBeCloseTo(entryAfter.left - entryBefore.left, 0);

    field.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }),
    );
    expect(a.description).toBe("Handles invoicing, half typed");
    expect(changes()).toBe(1);
    await scheduledWork();
  } finally {
    modeler.destroy();
    container.remove();
  }
});
