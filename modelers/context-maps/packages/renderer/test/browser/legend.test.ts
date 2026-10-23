import { expect, test } from "vitest";
import {
  Modeler,
  NavigatedViewer,
  cmLegendModule,
  renderLegend,
} from "@miragon/context-maps-renderer";
import type { CmLegend } from "@miragon/context-maps-renderer";
import { emptyDocument } from "@miragon/context-maps-schema-model";

/** A canvas of the given size: the viewer sizes its container to 100 %, so the size is the wrapper's. */
function mountContainer(width = 900, height = 900): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `position:absolute;left:0;top:0;width:${width}px;height:${height}px`;
  const container = document.createElement("div");
  wrapper.append(container);
  document.body.appendChild(wrapper);
  return container;
}

function unmount(container: HTMLElement): void {
  (container.parentElement ?? container).remove();
}

test("the legend card opens from its button, shows the full notation legend and collapses again", () => {
  const container = mountContainer();
  const modeler = new Modeler({ container, additionalModules: [cmLegendModule] });
  try {
    modeler.importDocument(emptyDocument("m"));

    const opener = container.querySelector<HTMLButtonElement>(".cm-legend-toggle");
    expect(opener).not.toBeNull();
    expect(opener!.getAttribute("aria-expanded")).toBe("false");
    opener!.click();

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
    unmount(container);
  }
});

test("the legend service is controllable by hosts", () => {
  const container = mountContainer();
  const modeler = new Modeler({ container, additionalModules: [cmLegendModule] });
  try {
    const legend = modeler.get<CmLegend>("cmLegend");
    expect(legend.isOpen()).toBe(false);
    legend.setOpen(true);
    expect(container.querySelector(".cm-legend")).not.toBeNull();
    legend.toggle();
    expect(legend.isOpen()).toBe(false);
    expect(container.querySelector(".cm-legend")).toBeNull();
    expect(container.querySelector(".cm-legend-toggle")).not.toBeNull();
  } finally {
    modeler.destroy();
    unmount(container);
  }
});

test("the legend card starts closed on every canvas size", () => {
  for (const { width, height } of [
    { width: 390, height: 844 },
    { width: 440, height: 900 },
    { width: 900, height: 820 },
    { width: 441, height: 821 },
    { width: 900, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    const container = mountContainer(width, height);
    const modeler = new Modeler({ container, additionalModules: [cmLegendModule] });
    try {
      modeler.importDocument(emptyDocument("m"));
      expect(modeler.get<CmLegend>("cmLegend").isOpen(), `${width} × ${height}`).toBe(false);
      expect(container.querySelector(".cm-legend-toggle"), `${width} × ${height}`).not.toBeNull();
      expect(container.querySelector(".cm-legend"), `${width} × ${height}`).toBeNull();
    } finally {
      modeler.destroy();
      unmount(container);
    }
  }
});

test("a canvas attached later keeps the legend closed; a host's stored state wins", () => {
  const target = mountContainer(1920, 1080);
  const size = { width: 1024, height: 900 };
  const later = new Modeler({ ...size, additionalModules: [cmLegendModule] });
  const stored = new Modeler({ ...size, additionalModules: [cmLegendModule] });
  try {
    later.attachTo(target);
    later.importDocument(emptyDocument("m"));
    expect(later.get<CmLegend>("cmLegend").isOpen()).toBe(false);
    later.detach();

    stored.get<CmLegend>("cmLegend").setOpen(true);
    stored.attachTo(target);
    stored.importDocument(emptyDocument("m"));
    expect(stored.get<CmLegend>("cmLegend").isOpen()).toBe(true);
    expect(target.querySelector(".cm-legend")).not.toBeNull();
  } finally {
    later.destroy();
    stored.destroy();
    unmount(target);
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
    unmount(container);
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
    expect(plain.querySelector(".cm-legend, .cm-legend-toggle")).toBeNull();
    expect(withLegend.querySelector(".cm-legend-toggle")).not.toBeNull();
  } finally {
    viewer.destroy();
    legendViewer.destroy();
    unmount(plain);
    unmount(withLegend);
  }
});
