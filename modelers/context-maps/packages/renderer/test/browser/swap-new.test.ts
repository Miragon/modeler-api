import { expect, test } from "vitest";
import { Modeler, isCmContext, isCmRelationship } from "@miragon/context-maps-renderer";
import type { CmModeling } from "@miragon/context-maps-renderer";
import { emptyDocument } from "@miragon/context-maps-schema-model";

// Swapping the ends of a NEWLY created connection (as drawn with the connect
// tool → modeling.connect) must work exactly like for an imported one.
test("swapEnds works on a connect-created relationship", () => {
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
    const rules = modeler.get<{ allowed(a: string, c: unknown): unknown }>("rules");
    const modeling = modeler.get<{ connect(a: unknown, b: unknown, attrs?: unknown): unknown }>(
      "modeling",
    );
    const cmModeling = modeler.get<CmModeling>("cmModeling");
    const canvas = modeler.get<{ getGraphics(el: unknown): SVGElement }>("canvas");
    const [a, b] = registry.getAll().filter(isCmContext);

    const attrs = rules.allowed("connection.create", { source: a, target: b });
    const conn = modeling.connect(a, b, attrs) as {
      source: { id: string };
      target: { id: string };
    };
    expect(isCmRelationship(conn)).toBe(true);
    expect(conn.source.id).toBe("a");
    expect(conn.target.id).toBe("b");

    const before = canvas.getGraphics(conn).querySelector("polyline")?.getAttribute("points");

    cmModeling.swapEnds(conn as never);

    expect(conn.source.id).toBe("b");
    expect(conn.target.id).toBe("a");
    const after = canvas.getGraphics(conn).querySelector("polyline")?.getAttribute("points");
    expect(after).not.toBe(before);
    expect(canvas.getGraphics(conn).querySelectorAll("polyline").length).toBe(1);
  } finally {
    modeler.destroy();
    container.remove();
  }
});
