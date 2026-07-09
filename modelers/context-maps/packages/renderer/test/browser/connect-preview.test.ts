import { expect, test } from "vitest";
import { Modeler, isCmContext } from "@miragon/context-maps-renderer";
import { emptyDocument } from "@miragon/context-maps-schema-model";

// The connect tool (context-pad arrow / palette) must show a live rubber-band
// line from the source context towards the cursor, and a click on another
// context must fix the relationship.
test("connect tool shows a preview line and a click on a target fixes it", () => {
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
    const eventBus = modeler.get<{ createEvent(data: unknown): Event }>("eventBus");
    const connect = modeler.get<{
      start(event: Event, start: unknown, autoActivate?: boolean): void;
    }>("connect");
    const dragging = modeler.get<{
      move(event: Event): void;
      hover(event: Event): void;
      end(): void;
    }>("dragging");
    const canvas = modeler.get<{
      getGraphics(el: unknown): SVGElement;
      viewbox(): { x: number; y: number; scale: number };
      getContainer(): HTMLElement;
    }>("canvas");
    const [a, b] = registry.getAll().filter(isCmContext);

    // diagram-js' Dragging reads client coordinates off the original DOM event;
    // translate canvas coordinates the same way its test helpers do.
    const canvasEvent = (x: number, y: number) => {
      const viewbox = canvas.viewbox();
      const clientRect = canvas.getContainer().getBoundingClientRect();
      const clientX = (x - viewbox.x) * viewbox.scale + clientRect.left;
      const clientY = (y - viewbox.y) * viewbox.scale + clientRect.top;
      return eventBus.createEvent({
        x,
        y,
        clientX,
        clientY,
        button: 0,
        originalEvent: { button: 0, clientX, clientY, buttons: 1 },
      });
    };

    // click on the connect arrow: start the tool from the source context
    connect.start(canvasEvent(200, 255), a, true);

    // moving over empty canvas: a rubber-band preview towards the cursor is shown
    dragging.move(canvasEvent(420, 350));
    const rubberBand = container.querySelector(".djs-dragger path, .djs-dragger polyline");
    expect(rubberBand).toBeTruthy();
    const geometry =
      rubberBand?.getAttribute("d") ?? rubberBand?.getAttribute("points") ?? "";
    expect(geometry).toContain("420,350");

    // hovering the target context: the styled relationship preview is shown
    dragging.hover(
      eventBus.createEvent({ element: b, gfx: canvas.getGraphics(b) }) as unknown as Event,
    );
    dragging.move(canvasEvent(700, 255));
    expect(container.querySelector(".djs-dragger polyline")).toBeTruthy();

    // click on the target: the connection is fixed and the preview removed
    dragging.end();
    expect(container.querySelector(".djs-dragger")).toBeNull();

    const exported = modeler.exportDocument();
    expect(exported.relationships).toHaveLength(1);
    expect(exported.relationships[0]).toMatchObject({
      from: "a",
      to: "b",
      pattern: "upstream-downstream",
    });
  } finally {
    modeler.destroy();
    container.remove();
  }
});
