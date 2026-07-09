import { expect, test } from "vitest";
import { Modeler, isCmContext } from "@miragon/context-maps-renderer";
import { emptyDocument } from "@miragon/context-maps-schema-model";

// Selecting a context must show FOUR connect arrows (mid top/right/bottom/left),
// and dragging from one to another context must create the relationship.
test("a selected context shows four connect handles that draw a relationship", () => {
  const container = document.createElement("div");
  container.style.width = "900px";
  container.style.height = "640px";
  document.body.appendChild(container);
  const modeler = new Modeler({ container });
  try {
    const doc = emptyDocument("m");
    doc.contexts = [
      { id: "a", label: "A", position: { x: 100, y: 200 }, size: { width: 200, height: 110 } },
      { id: "b", label: "B", position: { x: 600, y: 200 }, size: { width: 200, height: 110 } },
    ];
    modeler.importDocument(doc);

    const registry = modeler.get<{ getAll(): unknown[] }>("elementRegistry");
    const selection = modeler.get<{ select(el: unknown): void; deselect(el: unknown): void }>(
      "selection",
    );
    const canvas = modeler.get<{ getGraphics(el: unknown): SVGElement }>("canvas");
    const eventBus = modeler.get<{ createEvent(data: unknown): Event }>("eventBus");
    const dragging = modeler.get<{ hover(event: Event): void; move(event: Event): void; end(): void }>(
      "dragging",
    );
    const [a, b] = registry.getAll().filter(isCmContext);

    // no selection → no handles
    expect(container.querySelectorAll(".cm-connect-handle")).toHaveLength(0);

    selection.select(a);
    const handles = [...container.querySelectorAll<HTMLElement>(".cm-connect-handle")];
    expect(handles).toHaveLength(4);
    expect(handles.map((h) => h.dataset.side).sort()).toEqual(["bottom", "left", "right", "top"]);

    // press the right-side handle and complete the connection on B
    const right = handles.find((h) => h.dataset.side === "right")!;
    right.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 340, clientY: 255 }),
    );
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

    // deselect → handles disappear
    selection.select(null as unknown as object);
    expect(container.querySelectorAll(".cm-connect-handle")).toHaveLength(0);
  } finally {
    modeler.destroy();
    container.remove();
  }
});
