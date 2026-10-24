import { expect, test } from "vitest";
import { Modeler, isCmContext } from "@miragon/context-maps-renderer";
import { emptyDocument, type CmDocument } from "@miragon/context-maps-schema-model";

function mount(): { modeler: Modeler; container: HTMLDivElement } {
  const container = document.createElement("div");
  container.style.width = "900px";
  container.style.height = "640px";
  document.body.appendChild(container);
  return { modeler: new Modeler({ container }), container };
}

function mixedSizes(): CmDocument {
  const doc = emptyDocument("m");
  doc.contexts = [
    {
      id: "a",
      label: "Billing",
      subdomainType: "core",
      team: "Team Blue",
      position: { x: 100, y: 100 },
      size: { width: 200, height: 110 },
    },
    {
      id: "b",
      label: "Payments and Settlement Processing",
      subdomainType: "generic",
      position: { x: 400, y: 300 },
      size: { width: 240, height: 170 },
    },
    {
      id: "c",
      label: "Unclassified",
      position: { x: 100, y: 400 },
      size: { width: 200, height: 110 },
    },
  ];
  return doc;
}

function firstNameLineY(container: HTMLElement, id: string): number {
  const line = container.querySelector(`[data-element-id="${id}"] .djs-visual text.cm-name`);
  expect(line, `name line of "${id}"`).not.toBeNull();
  return parseFloat(line!.getAttribute("y") ?? "NaN");
}

test("the name sits at the same fixed top offset in every box", () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(mixedSizes());
    const small = firstNameLineY(container, "a");
    const tall = firstNameLineY(container, "b");
    const unclassified = firstNameLineY(container, "c");
    // CONTEXT_NAME_TOP (36) + half a line (13.5 * 1.2 / 2)
    expect(small).toBeCloseTo(44.1, 1);
    // taller box, wrapped multi-line name, missing type or team — the first
    // line never moves, so the gap below the header stays constant
    expect(tall).toBe(small);
    expect(unclassified).toBe(small);
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("auto-wrap measures real glyph widths, so no line exceeds the box", () => {
  const { modeler, container } = mount();
  try {
    const doc = emptyDocument("m");
    doc.contexts = [
      {
        id: "wide",
        label: "WWWWWWWW MMMMMMMM Enterprise Integration Backbone",
        subdomainType: "core",
        position: { x: 100, y: 100 },
        size: { width: 200, height: 110 },
      },
      {
        id: "longword",
        label: "Supercalifragilisticexpialigetisch",
        position: { x: 400, y: 100 },
        size: { width: 200, height: 110 },
      },
    ];
    modeler.importDocument(doc);
    const wrapWidth = 200 - 20;
    for (const id of ["wide", "longword"]) {
      const lines = [
        ...container.querySelectorAll(`[data-element-id="${id}"] .djs-visual text.cm-name`),
      ] as SVGTextElement[];
      expect(lines.length, `"${id}" wraps into multiple lines`).toBeGreaterThan(1);
      for (const line of lines) {
        expect(line.getComputedTextLength(), `line "${line.textContent}"`).toBeLessThanOrEqual(
          wrapWidth + 2,
        );
      }
    }
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("a name that would overflow the fixed box is truncated with an ellipsis", () => {
  const { modeler, container } = mount();
  try {
    const doc = emptyDocument("m");
    doc.contexts = [
      {
        id: "long",
        label:
          "Customer Relationship Management and Order Fulfilment Coordination Platform of Everything",
        subdomainType: "core",
        team: "Team Blue",
        position: { x: 100, y: 100 },
        size: { width: 200, height: 110 },
      },
    ];
    modeler.importDocument(doc);
    const lines = [
      ...container.querySelectorAll('[data-element-id="long"] .djs-visual text.cm-name'),
    ];
    // 110px box with a team leaves room for 3 lines (36px top, 18px reserve)
    expect(lines.length).toBe(3);
    expect(lines[2].textContent!.endsWith("…")).toBe(true);
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("undersized imported boxes are clamped up to the notation minimum", () => {
  const { modeler, container } = mount();
  try {
    const doc = emptyDocument("m");
    doc.contexts = [
      {
        id: "tiny",
        label: "Tiny",
        team: "Team Blue",
        position: { x: 100, y: 100 },
        size: { width: 100, height: 40 },
      },
    ];
    modeler.importDocument(doc);
    const registry = modeler.get<{ get(id: string): { width: number; height: number } }>(
      "elementRegistry",
    );
    const shape = registry.get("tiny");
    expect(shape.width).toBe(120);
    expect(shape.height).toBe(72);
    expect(modeler.exportDocument().contexts[0].size).toEqual({ width: 120, height: 72 });
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("the name edit box overlays the rendered name band exactly", () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(mixedSizes());
    const registry = modeler.get<{ get(id: string): unknown }>("elementRegistry");
    const selection = modeler.get<{ select(el: unknown): void }>("selection");
    const canvas = modeler.get<{
      zoom(): number;
      getAbsoluteBBox(el: unknown): { x: number; y: number; width: number; height: number };
    }>("canvas");
    const a = registry.get("a");
    selection.select(a);

    modeler.get<{ activate(el: unknown): void }>("cmLabelEditing").activate(a);
    const parent = container.querySelector<HTMLElement>(".djs-direct-editing-parent");
    expect(parent).not.toBeNull();
    const zoom = canvas.zoom();
    const bbox = canvas.getAbsoluteBBox(a);
    // fixed name-top offset, minus the 1px border, above the team reserve
    expect(parseFloat(parent!.style.top)).toBeCloseTo(bbox.y + 36 * zoom - 1, 0);
    expect(parseFloat(parent!.style.height)).toBeCloseTo(bbox.height - (36 + 18) * zoom, 0);
    modeler.get<{ cancel(): void }>("directEditing").cancel();
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("contexts cannot be resized", () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(mixedSizes());
    const registry = modeler.get<{ getAll(): unknown[] }>("elementRegistry");
    const selection = modeler.get<{ select(el: unknown): void }>("selection");
    const rules = modeler.get<{ allowed(action: string, context: object): boolean }>("rules");
    const [a] = registry.getAll().filter(isCmContext);

    expect(rules.allowed("shape.resize", { shape: a })).toBe(false);

    selection.select(a);
    expect(container.querySelector(".djs-resizer")).toBeNull();
  } finally {
    modeler.destroy();
    container.remove();
  }
});
