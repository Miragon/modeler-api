import { expect, test } from "vitest";
import { Modeler, isCmContext } from "@miragon/context-maps-renderer";
import type { CmModeling, CmRelationship } from "@miragon/context-maps-renderer";
import { emptyDocument } from "@miragon/context-maps-schema-model";

test("swapEnds reverses a relationship's source/target and re-renders one line", () => {
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
    const cmModeling = modeler.get<CmModeling>("cmModeling");
    const conn = registry.get("r") as CmRelationship & {
      source: { id: string };
      target: { id: string };
    };

    expect(conn.source.id).toBe("a");
    expect(conn.target.id).toBe("b");

    const canvas = modeler.get<{ getGraphics(el: unknown): SVGElement }>("canvas");
    const polyBefore = canvas.getGraphics(conn).querySelector("polyline")?.getAttribute("points");

    cmModeling.swapEnds(conn);

    expect(conn.source.id).toBe("b");
    expect(conn.target.id).toBe("a");

    // export reflects the swap
    const doc2 = modeler.exportDocument();
    expect(doc2.relationships[0].from).toBe("b");
    expect(doc2.relationships[0].to).toBe("a");

    // the rendered line updated (waypoints reversed) and is still a single polyline
    const polyAfter = canvas.getGraphics(conn).querySelector("polyline")?.getAttribute("points");
    expect(polyAfter).not.toBe(polyBefore);
    expect(canvas.getGraphics(conn).querySelectorAll("polyline").length).toBe(1);

    // undo restores the original direction
    modeler.undo();
    expect(conn.source.id).toBe("a");
    expect(conn.target.id).toBe("b");
    void isCmContext;
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("swapEnds keeps integration roles bound to their side, not to a context", () => {
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
    doc.relationships = [
      {
        id: "r",
        from: "a",
        to: "b",
        pattern: "upstream-downstream",
        upstreamRoles: ["OHS"],
        downstreamRoles: ["ACL"],
      },
    ];
    modeler.importDocument(doc);

    const registry = modeler.get<{ get(id: string): unknown }>("elementRegistry");
    const cmModeling = modeler.get<CmModeling>("cmModeling");
    const conn = registry.get("r") as CmRelationship;

    cmModeling.swapEnds(conn);

    // "b" is now upstream and carries the OHS side; "a" is downstream with ACL.
    const exported = modeler.exportDocument();
    expect(exported.relationships[0]).toMatchObject({
      from: "b",
      to: "a",
      upstreamRoles: ["OHS"],
      downstreamRoles: ["ACL"],
    });
  } finally {
    modeler.destroy();
    container.remove();
  }
});
