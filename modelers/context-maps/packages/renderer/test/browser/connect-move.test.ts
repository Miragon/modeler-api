import { expect, test } from "vitest";
import { Modeler, isCmContext } from "@miragon/context-maps-renderer";
import { emptyDocument } from "@miragon/context-maps-schema-model";

// Regression: moving a context must relayout its attached relationship lines so
// they stay docked to the box.
test("moving a context drags its connection along", () => {
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
    doc.relationships = [{ id: "r", from: "a", to: "b", pattern: "upstream-downstream" }];
    modeler.importDocument(doc);

    const registry = modeler.get<{ getAll(): unknown[]; get(id: string): unknown }>(
      "elementRegistry",
    );
    const modeling = modeler.get<{ moveElements(shapes: unknown[], delta: unknown): void }>(
      "modeling",
    );
    const a = registry
      .getAll()
      .filter(isCmContext)
      .find((c) => c.id === "a");
    const conn = registry.get("r") as { waypoints: Array<{ x: number; y: number }> };

    const canvas = modeler.get<{ getGraphics(el: unknown): SVGElement }>("canvas");
    const polyBefore = canvas.getGraphics(conn).querySelector("polyline")?.getAttribute("points");

    const before = conn.waypoints[0].y;
    modeling.moveElements([a], { x: 0, y: 200 }); // move A down by 200
    const after = conn.waypoints[0].y;

    expect(after).toBeGreaterThan(before + 100); // model: source end followed the box down

    // render: the drawn polyline must also reflect the new geometry
    const polyAfter = canvas.getGraphics(conn).querySelector("polyline")?.getAttribute("points");
    expect(polyAfter).not.toBe(polyBefore);

    // and the connection's gfx must hold exactly ONE polyline (no stale duplicate).
    expect(canvas.getGraphics(conn).querySelectorAll("polyline").length).toBe(1);
    // whole diagram: one polyline per relationship, none left behind.
    expect(container.querySelectorAll("polyline").length).toBe(1);
  } finally {
    modeler.destroy();
    container.remove();
  }
});
