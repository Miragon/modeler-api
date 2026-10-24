import { expect, test } from "vitest";
import { Modeler, isCmContext, isCmRelationship } from "@miragon/context-maps-renderer";
import { emptyDocument } from "@miragon/context-maps-schema-model";

// Regression: interactive connect must dock the relationship line to the context
// box borders (not run centre-to-centre). diagram-js' stock layouter returns
// mid→mid; CmLayouter crops via the cropping docking.
test("modeling.connect docks the relationship to the box borders", () => {
  const container = document.createElement("div");
  container.style.width = "900px";
  container.style.height = "640px";
  document.body.appendChild(container);
  const modeler = new Modeler({ container });
  try {
    const doc = emptyDocument("probe");
    doc.contexts = [
      { id: "a", label: "A", position: { x: 100, y: 200 }, size: { width: 200, height: 110 } },
      { id: "b", label: "B", position: { x: 600, y: 200 }, size: { width: 200, height: 110 } },
    ];
    modeler.importDocument(doc);

    const registry = modeler.get<{ getAll(): unknown[] }>("elementRegistry");
    const modeling = modeler.get<{ connect(a: unknown, b: unknown, attrs?: unknown): unknown }>(
      "modeling",
    );
    const contexts = registry.getAll().filter(isCmContext);
    const a = contexts.find((c) => c.id === "a");
    const b = contexts.find((c) => c.id === "b");

    const conn = modeling.connect(a, b, {
      cmKind: "relationship",
      pattern: "upstream-downstream",
    }) as { waypoints?: Array<{ x: number; y: number }> };

    expect(isCmRelationship(conn)).toBe(true);
    const wp = conn.waypoints ?? [];
    expect(wp.length).toBeGreaterThanOrEqual(2);
    // A's right border is x≈300, B's left border is x≈600 — NOT the centres (200 / 700).
    expect(wp[0].x).toBeGreaterThan(280);
    expect(wp[0].x).toBeLessThan(320);
    expect(wp[wp.length - 1].x).toBeGreaterThan(580);
    expect(wp[wp.length - 1].x).toBeLessThan(620);
  } finally {
    modeler.destroy();
    container.remove();
  }
});
