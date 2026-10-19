import { afterEach, expect, test } from "vitest";
import { Modeler } from "@miragon/context-maps-renderer";
import type { CmContext, CmLabelEditing } from "@miragon/context-maps-renderer";
import {
  SAMPLE_DOCUMENT,
  emptyDocument,
  parseDocumentText,
  serializeDocumentText,
} from "@miragon/context-maps-schema-model";
import type { CmDocument } from "@miragon/context-maps-schema-model";

const containers: HTMLElement[] = [];

afterEach(() => {
  for (const container of containers.splice(0)) container.remove();
});

/** The modeler sizes its container to 100 %, so the size comes from a wrapper around it. */
function mountModeler(): Modeler {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:absolute;left:0;top:0;width:900px;height:640px";
  const container = document.createElement("div");
  wrapper.append(container);
  document.body.appendChild(wrapper);
  containers.push(wrapper);
  return new Modeler({ container });
}

interface CommandStackLike {
  canUndo(): boolean;
  undo(): void;
}

function twoContexts(): CmDocument {
  const doc = emptyDocument("Two");
  doc.contexts = [
    { id: "a", label: "A", position: { x: 0, y: 0 }, size: { width: 200, height: 110 } },
    { id: "b", label: "B", position: { x: 400, y: 0 }, size: { width: 200, height: 110 } },
  ];
  return doc;
}

test("an import erases the undo history without a change event", () => {
  const modeler = mountModeler();
  try {
    modeler.importDocument(SAMPLE_DOCUMENT);
    modeler.setMeta({ title: "Renamed" });
    const stack = modeler.get<CommandStackLike>("commandStack");
    expect(stack.canUndo()).toBe(true);

    let changes = 0;
    modeler.on("commandStack.changed", () => (changes += 1));
    modeler.importDocument(twoContexts());
    expect(changes).toBe(0);
    expect(stack.canUndo()).toBe(false);
    stack.undo();
    expect(modeler.exportDocument().title).toBe("Two");
  } finally {
    modeler.destroy();
  }
});

test("a document with a duplicate or reserved id is rejected before anything changes", () => {
  const modeler = mountModeler();
  try {
    modeler.importDocument(SAMPLE_DOCUMENT);
    const before = modeler.exportText();

    const duplicate = twoContexts();
    duplicate.relationships = [{ id: "a", from: "a", to: "b", pattern: "partnership" }];
    expect(() => modeler.importDocument(duplicate)).toThrow(/more than once/);

    const reserved = twoContexts();
    reserved.contexts[0]!.id = "cm-root";
    expect(() => modeler.importDocument(reserved)).toThrow(/reserved/);

    expect(modeler.exportText()).toBe(before);
  } finally {
    modeler.destroy();
  }
});

test("unknown keys and relationships to a missing context survive import and export", () => {
  const modeler = mountModeler();
  try {
    const parsed = parseDocumentText(
      JSON.stringify({
        version: 1,
        title: "Foreign",
        "x-vendor": { owner: "team-a" },
        contexts: [
          {
            id: "a",
            label: "A",
            position: { x: 0, y: 0 },
            size: { width: 200, height: 110 },
            "x-color-hint": "teal",
          },
        ],
        relationships: [
          { id: "r", from: "a", to: "ghost", pattern: "partnership", "x-note": "kept" },
        ],
      }),
    );
    if (!parsed.ok) throw new Error(parsed.error);
    const { warnings } = modeler.importDocument(parsed.document);
    expect(warnings.map((warning) => warning.elementId)).toEqual(["r"]);

    const exported = JSON.parse(modeler.exportText()) as Record<string, unknown>;
    expect(exported["x-vendor"]).toEqual({ owner: "team-a" });
    expect((exported.contexts as Array<Record<string, unknown>>)[0]!["x-color-hint"]).toBe("teal");
    expect(exported.relationships).toEqual([
      { id: "r", from: "a", to: "ghost", pattern: "partnership", "x-note": "kept" },
    ]);
  } finally {
    modeler.destroy();
  }
});

test("an export or an edit before the first import leaves the first import intact", () => {
  const modeler = mountModeler();
  try {
    expect(modeler.exportDocument().contexts).toEqual([]);
    const factory = modeler.get<{ createNewContext(): CmContext }>("cmElementFactory");
    const modeling = modeler.get<{
      createShape(shape: unknown, position: { x: number; y: number }, parent: unknown): unknown;
    }>("modeling");
    const canvas = modeler.get<{ getRootElement(): unknown }>("canvas");
    modeling.createShape(factory.createNewContext(), { x: 100, y: 100 }, canvas.getRootElement());

    modeler.importDocument(SAMPLE_DOCUMENT);
    expect(modeler.exportText()).toBe(serializeDocumentText(SAMPLE_DOCUMENT));
    modeler.importDocument(twoContexts());
    expect(modeler.exportDocument().contexts.map((context) => context.id)).toEqual(["a", "b"]);
  } finally {
    modeler.destroy();
  }
});

test("an import fits the content at no more than 100 %, an empty map shows 100 %", () => {
  const modeler = mountModeler();
  try {
    const canvas = modeler.get<{ zoom(): number }>("canvas");
    modeler.importDocument(twoContexts());
    expect(canvas.zoom()).toBe(1);
    modeler.importDocument(SAMPLE_DOCUMENT);
    expect(canvas.zoom()).toBeLessThan(1);
    modeler.importDocument(emptyDocument("Empty"));
    expect(canvas.zoom()).toBe(1);
  } finally {
    modeler.destroy();
  }
});

test("a title change is an undoable command", () => {
  const modeler = mountModeler();
  try {
    modeler.importDocument(SAMPLE_DOCUMENT);
    let changes = 0;
    modeler.on("commandStack.changed", () => (changes += 1));
    modeler.setMeta({ title: "Renamed" });
    expect(changes).toBe(1);
    expect(modeler.exportDocument().title).toBe("Renamed");
    modeler.undo();
    expect(modeler.exportDocument().title).toBe(SAMPLE_DOCUMENT.title);
  } finally {
    modeler.destroy();
  }
});

test("a label edit open during an import is not committed and reopens on the same id", async () => {
  const modeler = mountModeler();
  try {
    modeler.importDocument(SAMPLE_DOCUMENT);
    const labelEditing = modeler.get<CmLabelEditing>("cmLabelEditing");
    const registry = modeler.get<{ get(id: string): unknown }>("elementRegistry");
    labelEditing.activate(registry.get("ctx_cfp") as CmContext);
    const field = modeler.container.querySelector<HTMLElement>(".djs-direct-editing-content");
    if (!field) throw new Error("no label editor opened");
    field.innerText = "typed, not committed";

    let changes = 0;
    modeler.on("commandStack.changed", () => (changes += 1));
    modeler.importDocument(SAMPLE_DOCUMENT);
    expect(changes).toBe(0);
    expect(modeler.exportText()).toBe(serializeDocumentText(SAMPLE_DOCUMENT));

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(labelEditing.openEdit()).toEqual({
      elementId: "ctx_cfp",
      text: "typed, not committed",
    });
  } finally {
    modeler.destroy();
  }
});
