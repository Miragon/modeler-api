import { expect, test } from "vitest";
import { Modeler, isCmContext } from "@miragon/context-maps-renderer";
import { emptyDocument } from "@miragon/context-maps-schema-model";

test("connect, delete, connect again", () => {
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
    const rules = modeler.get<{ allowed(r: string, c: unknown): unknown }>("rules");
    const modeling = modeler.get<{
      connect(a: unknown, b: unknown, attrs?: unknown): unknown;
      removeElements(els: unknown[]): void;
    }>("modeling");
    const [a, b] = registry.getAll().filter(isCmContext) as Array<{
      incoming?: unknown[];
      outgoing?: unknown[];
    }>;

    const attrs1 = rules.allowed("connection.create", { source: a, target: b });
    expect(attrs1).toBeTruthy();
    const conn = modeling.connect(a, b, attrs1);
    expect(rules.allowed("connection.create", { source: a, target: b })).toBe(false);

    modeling.removeElements([conn]);
    console.log("after delete: a.outgoing", a.outgoing?.length, "b.incoming", b.incoming?.length);
    const attrs2 = rules.allowed("connection.create", { source: a, target: b });
    console.log("allowed after delete:", JSON.stringify(attrs2));
    expect(attrs2).toBeTruthy();

    const conn2 = modeling.connect(a, b, attrs2);
    expect(conn2).toBeTruthy();
    expect(modeler.exportDocument().relationships).toHaveLength(1);
  } finally {
    modeler.destroy();
    container.remove();
  }
});
