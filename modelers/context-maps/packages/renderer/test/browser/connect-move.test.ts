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

    // Regression: diagram-js passes `connectionEnd: false` for the end that did
    // not move — the line must keep BOTH ends, not collapse to a single point.
    expect(conn.waypoints.length).toBeGreaterThanOrEqual(2);

    // Regression: the source end must sit ON the moved box border (a is now at
    // 100/400, 200x110) — stale move anchors once detached the line from the box.
    const dock = conn.waypoints[0];
    expect(dock.x).toBeGreaterThanOrEqual(100);
    expect(dock.x).toBeLessThanOrEqual(300);
    expect(dock.y).toBeGreaterThanOrEqual(400);
    expect(dock.y).toBeLessThanOrEqual(510);

    // render: the drawn polyline must also reflect the new geometry
    const polyAfter = canvas.getGraphics(conn).querySelector("polyline")?.getAttribute("points");
    expect(polyAfter).not.toBe(polyBefore);
    expect(polyAfter?.split(" ").length).toBeGreaterThanOrEqual(2);

    // and the connection's gfx must hold exactly ONE polyline (no stale duplicate).
    expect(canvas.getGraphics(conn).querySelectorAll("polyline").length).toBe(1);
    // whole diagram: one polyline per relationship, none left behind.
    expect(container.querySelectorAll("polyline").length).toBe(1);
  } finally {
    modeler.destroy();
    container.remove();
  }
});

// Regression: moving BOTH connected contexts together (lasso multi-select)
// translated the relationship twice — once by the per-shape relayout, once by
// diagram-js' enclosed-connection translation — so the line drifted away by a
// full extra delta. It must stay docked edge-to-edge and undo cleanly.
test("moving two connected contexts together keeps the line docked", () => {
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

    const registry = modeler.get<{ get(id: string): unknown }>("elementRegistry");
    const modeling = modeler.get<{
      moveElements(elements: unknown[], delta: { x: number; y: number }): void;
    }>("modeling");
    const a = registry.get("a") as { x: number; width: number };
    const b = registry.get("b") as { x: number };
    const r = registry.get("r") as { waypoints: Array<{ x: number; y: number }> };

    modeling.moveElements([a, b, r], { x: 60, y: 40 });

    // both boxes moved; the line spans right edge of A to left edge of B at mid height
    expect(a.x).toBe(160);
    expect(b.x).toBe(660);
    expect(r.waypoints).toHaveLength(2);
    expect(r.waypoints[0]).toMatchObject({ x: 360, y: 295 });
    expect(r.waypoints[1]).toMatchObject({ x: 660, y: 295 });

    modeler.undo();
    expect(r.waypoints[0]).toMatchObject({ x: 300, y: 255 });
    expect(r.waypoints[1]).toMatchObject({ x: 600, y: 255 });
  } finally {
    modeler.destroy();
    container.remove();
  }
});
