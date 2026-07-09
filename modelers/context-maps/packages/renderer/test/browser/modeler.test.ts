import { expect, test } from "vitest";
import { Modeler, isCmContext } from "@miragon/context-maps-renderer";
import type { CmContext, CmElement } from "@miragon/context-maps-renderer";
import { SAMPLE_DOCUMENT } from "@miragon/context-maps-schema-model";

function mountModeler(): { modeler: Modeler; container: HTMLDivElement } {
  const container = document.createElement("div");
  container.style.width = "900px";
  container.style.height = "640px";
  document.body.appendChild(container);
  return { modeler: new Modeler({ container }), container };
}

// Real-browser integration: diagram-js relies on SVGElement.getBBox() / getComputedTextLength(),
// which jsdom cannot provide — so this runs in headless Chromium (npm run test:browser).
test("renders the sample context map and exports an SVG snapshot", () => {
  const { modeler, container } = mountModeler();
  try {
    const { warnings } = modeler.importDocument(SAMPLE_DOCUMENT);
    expect(warnings).toHaveLength(0);

    const exported = modeler.exportDocument();
    expect(exported.contexts).toHaveLength(SAMPLE_DOCUMENT.contexts.length);
    expect(exported.relationships).toHaveLength(SAMPLE_DOCUMENT.relationships.length);

    const { svg } = modeler.saveSVG();
    expect(svg).toContain("<svg");
  } finally {
    modeler.destroy();
    container.remove();
  }
});

// Regression: contexts must never "glue" to one another. diagram-js otherwise
// re-parents a shape into whatever it is dropped on, so the two move together.
test("dropping a context onto another does not re-parent it", () => {
  const { modeler, container } = mountModeler();
  try {
    modeler.importDocument(SAMPLE_DOCUMENT);

    const registry = modeler.get<{ getAll(): CmElement[] }>("elementRegistry");
    const rules = modeler.get<{ allowed(action: string, context: unknown): unknown }>("rules");
    const root = modeler.get<{ getRootElement(): unknown }>("canvas").getRootElement();
    const contexts = registry.getAll().filter(isCmContext);
    expect(contexts.length).toBeGreaterThanOrEqual(2);

    expect(rules.allowed("elements.move", { shapes: [contexts[0]], target: contexts[1] })).toBe(
      null,
    );
    expect(rules.allowed("elements.move", { shapes: [contexts[0]], target: root })).toBe(true);
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("a relationship may connect two distinct contexts but not a self-loop", () => {
  const { modeler, container } = mountModeler();
  try {
    modeler.importDocument(SAMPLE_DOCUMENT);

    const registry = modeler.get<{ getAll(): CmElement[] }>("elementRegistry");
    const rules = modeler.get<{ allowed(action: string, context: unknown): unknown }>("rules");
    const contexts = registry.getAll().filter(isCmContext) as CmContext[];

    const ok = rules.allowed("connection.create", {
      source: contexts[0],
      target: contexts[1],
    });
    expect(ok).toBeTruthy();

    const self = rules.allowed("connection.create", {
      source: contexts[0],
      target: contexts[0],
    });
    expect(self).toBe(false);
  } finally {
    modeler.destroy();
    container.remove();
  }
});
