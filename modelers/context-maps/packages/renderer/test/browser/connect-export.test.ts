import { expect, test } from "vitest";
import { Modeler, isCmContext, isCmRelationship } from "@miragon/context-maps-renderer";
import { emptyDocument } from "@miragon/context-maps-schema-model";

// A relationship created interactively (via the connect tool → modeling.connect
// with the rule's attrs) must be a real CmRelationship AND survive export, so it
// is persisted (URL / autosave) and swappable.
test("an interactively-created connection is a relationship and is exported", () => {
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
    const [a, b] = registry.getAll().filter(isCmContext);

    // This is exactly what the connect tool passes: the 'connection.create' rule result.
    const attrs = rules.allowed("connection.create", { source: a, target: b });
    expect(attrs).toBeTruthy();

    const conn = modeling.connect(a, b, attrs);
    expect(isCmRelationship(conn)).toBe(true);

    const exported = modeler.exportDocument();
    expect(exported.relationships).toHaveLength(1);
    expect(exported.relationships[0].pattern).toBe("upstream-downstream");
    expect(exported.relationships[0].from).toBe("a");
    expect(exported.relationships[0].to).toBe("b");
  } finally {
    modeler.destroy();
    container.remove();
  }
});
