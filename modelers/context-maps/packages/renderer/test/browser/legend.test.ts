import { expect, test } from "vitest";
import { Modeler, NavigatedViewer, cmLegendModule } from "@miragon/context-maps-renderer";
import type { CmLegend } from "@miragon/context-maps-renderer";
import { emptyDocument } from "@miragon/context-maps-schema-model";

function mountContainer(): HTMLDivElement {
  const container = document.createElement("div");
  container.style.width = "900px";
  container.style.height = "640px";
  document.body.appendChild(container);
  return container;
}

test("the modeler shows the full notation legend and collapses to a button", () => {
  const container = mountContainer();
  const modeler = new Modeler({ container });
  try {
    modeler.importDocument(emptyDocument("m"));

    const legend = container.querySelector(".cm-legend");
    expect(legend).not.toBeNull();
    // three groups: subdomain types (3), integration roles (4), patterns (5)
    expect(legend!.querySelectorAll(".cm-legend__group")).toHaveLength(3);
    expect(legend!.querySelectorAll(".cm-legend__row")).toHaveLength(12);
    // every row explains itself on hover
    expect(legend!.querySelectorAll(".cm-legend-tip")).toHaveLength(12);
    expect(legend!.textContent).toContain("Core Domain");
    expect(legend!.textContent).toContain("Open Host Service");
    expect(legend!.textContent).toContain("SK · Shared Kernel");

    legend!.querySelector<HTMLButtonElement>(".cm-legend__close")!.click();
    expect(container.querySelector(".cm-legend")).toBeNull();
    const toggle = container.querySelector<HTMLButtonElement>(".cm-legend-toggle");
    expect(toggle).not.toBeNull();
    expect(toggle!.getAttribute("aria-expanded")).toBe("false");

    toggle!.click();
    expect(container.querySelector(".cm-legend")).not.toBeNull();
    expect(container.querySelector(".cm-legend-toggle")).toBeNull();
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("the legend service is controllable by hosts", () => {
  const container = mountContainer();
  const modeler = new Modeler({ container });
  try {
    const legend = modeler.get<CmLegend>("cmLegend");
    expect(legend.isOpen()).toBe(true);
    legend.setOpen(false);
    expect(container.querySelector(".cm-legend")).toBeNull();
    legend.toggle();
    expect(legend.isOpen()).toBe(true);
    expect(container.querySelector(".cm-legend")).not.toBeNull();
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("viewers stay legend-free unless the module is added explicitly", () => {
  const plain = mountContainer();
  const withLegend = mountContainer();
  const viewer = new NavigatedViewer({ container: plain });
  const legendViewer = new NavigatedViewer({
    container: withLegend,
    additionalModules: [cmLegendModule],
  });
  try {
    viewer.importDocument(emptyDocument("m"));
    legendViewer.importDocument(emptyDocument("m"));
    expect(plain.querySelector(".cm-legend")).toBeNull();
    expect(withLegend.querySelector(".cm-legend")).not.toBeNull();
  } finally {
    viewer.destroy();
    legendViewer.destroy();
    plain.remove();
    withLegend.remove();
  }
});
