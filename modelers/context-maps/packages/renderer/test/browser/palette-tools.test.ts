import { expect, test } from "vitest";
import { Modeler } from "@miragon/context-maps-renderer";
import { emptyDocument } from "@miragon/context-maps-schema-model";

function mount(): { modeler: Modeler; container: HTMLDivElement } {
  const container = document.createElement("div");
  container.style.width = "900px";
  container.style.height = "640px";
  document.body.appendChild(container);
  return { modeler: new Modeler({ container }), container };
}

function importTwoContexts(modeler: Modeler): void {
  const doc = emptyDocument("m");
  doc.contexts = [
    { id: "a", label: "A", position: { x: 100, y: 200 }, size: { width: 200, height: 110 } },
    { id: "b", label: "B", position: { x: 600, y: 200 }, size: { width: 200, height: 110 } },
  ];
  modeler.importDocument(doc);
}

/** Map a canvas point to client coordinates (viewbox-aware). */
function clientPoint(modeler: Modeler, x: number, y: number): { clientX: number; clientY: number } {
  const canvas = modeler.get<{
    viewbox(): { x: number; y: number; scale: number };
    getContainer(): HTMLElement;
  }>("canvas");
  const viewbox = canvas.viewbox();
  const rect = canvas.getContainer().getBoundingClientRect();
  return {
    clientX: (x - viewbox.x) * viewbox.scale + rect.left,
    clientY: (y - viewbox.y) * viewbox.scale + rect.top,
  };
}

test("the palette offers the lasso tool ahead of the create entries", () => {
  const { modeler, container } = mount();
  try {
    importTwoContexts(modeler);
    const actions = [...container.querySelectorAll(".djs-palette .entry")].map((entry) =>
      entry.getAttribute("data-action"),
    );
    expect(actions).toEqual([
      "lasso-tool",
      "context.core",
      "context.supporting",
      "context.generic",
    ]);
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("the lasso tool rubber-band selects multiple contexts", () => {
  const { modeler, container } = mount();
  try {
    importTwoContexts(modeler);
    const selection = modeler.get<{ get(): unknown[] }>("selection");
    const eventBus = modeler.get<{ createEvent(data: unknown): Event }>("eventBus");
    const dragging = modeler.get<{ move(event: Event): void; end(): void }>("dragging");

    const lassoEntry = container.querySelector<HTMLElement>(
      '.djs-palette [data-action="lasso-tool"]',
    )!;
    lassoEntry.dispatchEvent(
      new MouseEvent("click", { bubbles: true, button: 0, ...clientPoint(modeler, 50, 150) }),
    );
    // armed: diagram-js' tool manager highlights the palette entry
    expect(lassoEntry.classList.contains("highlighted-entry")).toBe(true);

    // the armed tool hands over to the actual rubber-band drag on the next
    // canvas press — driven directly here (synthetic events carry no DOM target)
    const lassoTool = modeler.get<{
      activateLasso(event: MouseEvent, autoActivate?: boolean): void;
    }>("lassoTool");
    lassoTool.activateLasso(
      new MouseEvent("mousedown", { button: 0, ...clientPoint(modeler, 50, 150) }),
      true,
    );
    const end = clientPoint(modeler, 850, 400);
    dragging.move(eventBus.createEvent({ x: 850, y: 400, ...end }) as unknown as Event);
    dragging.end();

    expect(selection.get()).toHaveLength(2);
    expect(lassoEntry.classList.contains("highlighted-entry")).toBe(false);
  } finally {
    modeler.destroy();
    container.remove();
  }
});
