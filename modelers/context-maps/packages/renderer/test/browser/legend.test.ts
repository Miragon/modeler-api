import { expect, test } from "vitest";
import {
  Modeler,
  NavigatedViewer,
  cmLegendModule,
  renderLegend,
} from "@miragon/context-maps-renderer";
import type { CmLegend } from "@miragon/context-maps-renderer";
import { emptyDocument } from "@miragon/context-maps-schema-model";

function mountContainer(): HTMLDivElement {
  const container = document.createElement("div");
  container.style.width = "900px";
  container.style.height = "640px";
  document.body.appendChild(container);
  return container;
}

test("the legend card shows the full notation legend and collapses to a button", () => {
  const container = mountContainer();
  const modeler = new Modeler({ container, additionalModules: [cmLegendModule] });
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
  const modeler = new Modeler({ container, additionalModules: [cmLegendModule] });
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

test("the modeler leaves the legend to its host's chrome", () => {
  const container = mountContainer();
  const modeler = new Modeler({ container });
  try {
    modeler.importDocument(emptyDocument("m"));
    expect(container.querySelector(".cm-legend, .cm-legend-toggle")).toBeNull();
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("renderLegend fills a chrome's legend body with the shell's rows and tooltips", () => {
  const body = document.createElement("div");
  const attached: Array<{ control: HTMLElement; label: string }> = [];
  const detach = renderLegend(body, {
    tooltip: {
      attach(control, content) {
        attached.push({ control, label: content.label });
        return () =>
          attached.splice(attached.indexOf(attached.find((a) => a.control === control)!), 1);
      },
    },
  });
  expect(body.querySelectorAll(".cd-shell-legend-row")).toHaveLength(12);
  expect(body.querySelectorAll(".cd-shell-legend-preview svg")).toHaveLength(12);
  expect(body.querySelectorAll(".cd-shell-legend-separator")).toHaveLength(2);
  expect(
    [...body.querySelectorAll('[role="group"]')].map((g) => g.getAttribute("aria-label")),
  ).toEqual(["Subdomain types", "Integration roles", "Relationship patterns"]);
  expect(body.textContent).toContain("SK · Shared Kernel");
  expect(body.querySelector("[title]")).toBeNull();
  expect(attached).toHaveLength(12);
  expect(attached[0]!.label).toContain("Business-critical");
  detach();
  expect(attached).toHaveLength(0);

  const withoutTooltip = document.createElement("div");
  renderLegend(withoutTooltip);
  expect(withoutTooltip.querySelectorAll(".cm-visually-hidden")).toHaveLength(12);
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
