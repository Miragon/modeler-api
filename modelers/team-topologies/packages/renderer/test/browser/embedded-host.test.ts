import { afterEach, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import type Canvas from "diagram-js/lib/core/Canvas";
import type ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import type Palette from "diagram-js/lib/features/palette/Palette";
import type Selection from "diagram-js/lib/features/selection/Selection";
import type { Element } from "diagram-js/lib/model/Types";
import type { ModuleDeclaration } from "didi";
import type { FreeArea, FreeAreaInsets } from "@miragon/modeler-api";
import { Modeler } from "@miragon/team-topologies-renderer";
import { emptyDocument, type TtDocument } from "@miragon/team-topologies-schema-model";

// An embedded host such as designIQ's MCP widget: 720 × 520, palette in the second row, with
// chrome of its own along the edges that it reports as `freeArea.insets` (guide §5.9).
const WIDGET = { width: 720, height: 520 };
const WIDGET_INSETS: FreeAreaInsets = { top: 140, right: 24, bottom: 64, left: 24 };
/** The host's zoom group in the bottom right corner (guide §5.8: 173 × 40 at 12px). */
const ZOOM_GROUP = { width: 173, height: 40, edge: 12 };
/** diagram-js's gap between an element and its pad at 100 %. */
const PAD_GAP = 8;
const CONTAINER_EDGE = 12;
const PALETTE_GAP = 8;

const NO_INSETS: FreeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

const CORNER_TEAM = "team_corner";
const SHAPE_EDGE = 12;

interface Host {
  host: HTMLDivElement;
  container: HTMLDivElement;
  modeler: Modeler;
}

const mounted: Host[] = [];

afterEach(() => {
  for (const { modeler, host } of mounted.splice(0)) {
    modeler.destroy();
    host.remove();
  }
});

function mountHost(
  box: { left: number; top: number; width: number; height: number },
  freeArea?: FreeArea,
  additionalModules?: ModuleDeclaration[],
): Host {
  const host = document.createElement("div");
  host.style.cssText = `position: fixed; left: ${box.left}px; top: ${box.top}px; width: ${box.width}px; height: ${box.height}px;`;
  const container = document.createElement("div");
  host.append(container);
  document.body.append(host);
  const modeler = new Modeler({ container, freeArea, additionalModules });
  const mount = { host, container, modeler };
  mounted.push(mount);
  return mount;
}

function addZoomGroup(host: HTMLElement): HTMLElement {
  const zoomGroup = document.createElement("div");
  zoomGroup.style.cssText = `position: absolute; right: ${ZOOM_GROUP.edge}px; bottom: ${ZOOM_GROUP.edge}px; width: ${ZOOM_GROUP.width}px; height: ${ZOOM_GROUP.height}px; z-index: 20; background: white;`;
  host.append(zoomGroup);
  return zoomGroup;
}

function oneTeamDocument(): TtDocument {
  return {
    ...emptyDocument("Embedded"),
    nodes: [
      {
        id: CORNER_TEAM,
        type: "platform",
        label: "Corner team",
        position: { x: 0, y: 0 },
        size: { width: 160, height: 80 },
      },
    ],
  };
}

function teamBounds(modeler: Modeler) {
  return modeler.get<ElementRegistry>("elementRegistry").get(CORNER_TEAM) as unknown as {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/** Sets the view at `scale` so the team's bottom right corner sits `SHAPE_EDGE` from the container's. */
function moveTeamToBottomRight(modeler: Modeler, scale = 1): void {
  const canvas = modeler.get<Canvas>("canvas");
  const { width, height } = canvas.getSize();
  const team = teamBounds(modeler);
  canvas.viewbox({
    x: team.x + team.width - (width - SHAPE_EDGE) / scale,
    y: team.y + team.height - (height - SHAPE_EDGE) / scale,
    width: width / scale,
    height: height / scale,
  });
}

/** Sets the view at 100 % so the team's top left corner sits at `at`, in px from the container's. */
function moveTeamTo(modeler: Modeler, at: { x: number; y: number }): void {
  const canvas = modeler.get<Canvas>("canvas");
  const { width, height } = canvas.getSize();
  const team = teamBounds(modeler);
  canvas.viewbox({ x: team.x - at.x, y: team.y - at.y, width, height });
}

function select(modeler: Modeler, id: string): void {
  const element = modeler.get<ElementRegistry>("elementRegistry").get(id) as Element;
  modeler.get<Selection>("selection").select(element);
}

/** Lets diagram-js's scheduled pad updates, and the placement after them, run. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50));
}

function openPad(container: HTMLElement): HTMLElement {
  const pad = container.querySelector<HTMLElement>(".djs-context-pad.open");
  if (!pad) throw new Error("No context pad is open.");
  return pad;
}

function boxIn(element: Element | HTMLElement, origin: HTMLElement): DOMRect {
  const box = (element as HTMLElement).getBoundingClientRect();
  const originBox = origin.getBoundingClientRect();
  return new DOMRect(box.left - originBox.left, box.top - originBox.top, box.width, box.height);
}

function graphicsOf(modeler: Modeler, id: string): HTMLElement {
  return modeler.get<ElementRegistry>("elementRegistry").getGraphics(id) as unknown as HTMLElement;
}

function expectInside(
  box: DOMRect,
  area: { width: number; height: number },
  insets: FreeAreaInsets,
) {
  expect(box.left).toBeGreaterThanOrEqual(insets.left);
  expect(box.top).toBeGreaterThanOrEqual(insets.top);
  expect(box.right).toBeLessThanOrEqual(area.width - insets.right);
  expect(box.bottom).toBeLessThanOrEqual(area.height - insets.bottom);
}

/** Every entry is the topmost element at its centre, so a pointer reaches it. */
function expectEveryEntryReachable(pad: HTMLElement): void {
  const entries = [...pad.querySelectorAll<HTMLElement>(".entry")];
  expect(entries.length).toBeGreaterThan(0);
  for (const entry of entries) {
    const box = entry.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    expect(hit?.closest(".entry"), entry.getAttribute("aria-label") ?? "").toBe(entry);
  }
}

test("a shape in the bottom right corner of a 720 × 520 host keeps its pad inside the free area", async () => {
  await page.viewport(WIDGET.width, WIDGET.height);
  const { host, container, modeler } = mountHost(
    { left: 0, top: 0, ...WIDGET },
    { insets: () => WIDGET_INSETS },
  );
  addZoomGroup(host);
  modeler.importDocument(oneTeamDocument());
  moveTeamToBottomRight(modeler);

  select(modeler, CORNER_TEAM);
  await settle();

  const pad = openPad(container);
  const padBox = boxIn(pad, container);
  expectInside(padBox, WIDGET, WIDGET_INSETS);
  // Flipped to the left of the shape rather than laid over it.
  expect(padBox.right).toBeLessThanOrEqual(boxIn(graphicsOf(modeler, CORNER_TEAM), container).left);
  expectEveryEntryReachable(pad);

  await userEvent.click(pad.querySelector<HTMLElement>('.entry[data-action="delete"]')!);
  expect(modeler.get<ElementRegistry>("elementRegistry").get(CORNER_TEAM)).toBeUndefined();
});

test("the pad follows into the free area when the view moves its shape into the corner", async () => {
  await page.viewport(WIDGET.width, WIDGET.height);
  const { host, container, modeler } = mountHost(
    { left: 0, top: 0, ...WIDGET },
    { insets: () => WIDGET_INSETS },
  );
  addZoomGroup(host);
  modeler.importDocument(oneTeamDocument());
  select(modeler, CORNER_TEAM);
  await settle();

  moveTeamToBottomRight(modeler);
  await settle();

  const pad = openPad(container);
  expectInside(boxIn(pad, container), WIDGET, WIDGET_INSETS);
  expectEveryEntryReachable(pad);
});

test("a pad that fits stays where diagram-js puts it: right of its shape, top-aligned", async () => {
  await page.viewport(WIDGET.width, WIDGET.height);
  const { container, modeler } = mountHost(
    { left: 0, top: 0, ...WIDGET },
    { insets: () => WIDGET_INSETS },
  );
  modeler.importDocument(oneTeamDocument());
  const canvas = modeler.get<Canvas>("canvas");
  canvas.viewbox({ x: -200, y: -200, width: WIDGET.width, height: WIDGET.height });

  select(modeler, CORNER_TEAM);
  await settle();

  const padBox = boxIn(openPad(container), container);
  const shapeBox = boxIn(graphicsOf(modeler, CORNER_TEAM), container);
  expect(padBox.left).toBeCloseTo(shapeBox.right + PAD_GAP, 0);
  expect(padBox.top).toBeCloseTo(shapeBox.top, 0);
});

test("without insets from the host, the pad keeps inside the container", async () => {
  await page.viewport(WIDGET.width, WIDGET.height);
  const { container, modeler } = mountHost({ left: 0, top: 0, ...WIDGET });
  modeler.importDocument(oneTeamDocument());
  moveTeamToBottomRight(modeler);

  select(modeler, CORNER_TEAM);
  await settle();

  const pad = openPad(container);
  expectInside(boxIn(pad, container), WIDGET, NO_INSETS);
  expectEveryEntryReachable(pad);
});

test("the pad is never shown where diagram-js first puts it, outside the free area", async () => {
  await page.viewport(WIDGET.width, WIDGET.height);
  const { container, modeler } = mountHost(
    { left: 0, top: 0, ...WIDGET },
    { insets: () => WIDGET_INSETS },
  );
  modeler.importDocument(oneTeamDocument());
  moveTeamTo(modeler, { x: 200, y: 200 });
  select(modeler, CORNER_TEAM);
  await settle();

  // Each write to the pad's position is seen here before the page paints again.
  const pad = openPad(container);
  const positionsBeforePaint: DOMRect[] = [];
  const observer = new MutationObserver(() => positionsBeforePaint.push(boxIn(pad, container)));
  observer.observe(pad, { attributes: true, attributeFilter: ["style"] });
  moveTeamToBottomRight(modeler);
  await settle();
  observer.disconnect();

  expect(positionsBeforePaint.length).toBeGreaterThan(0);
  for (const position of positionsBeforePaint) expectInside(position, WIDGET, WIDGET_INSETS);
});

test("a pad above the free area moves down to its top and stays beside its shape", async () => {
  await page.viewport(WIDGET.width, WIDGET.height);
  const { container, modeler } = mountHost(
    { left: 0, top: 0, ...WIDGET },
    { insets: () => WIDGET_INSETS },
  );
  modeler.importDocument(oneTeamDocument());
  moveTeamTo(modeler, { x: 200, y: WIDGET_INSETS.top - 40 });

  select(modeler, CORNER_TEAM);
  await settle();

  const padBox = boxIn(openPad(container), container);
  const shapeBox = boxIn(graphicsOf(modeler, CORNER_TEAM), container);
  expect(shapeBox.top).toBeLessThan(WIDGET_INSETS.top);
  expect(padBox.top).toBeCloseTo(WIDGET_INSETS.top, 0);
  expect(padBox.left).toBeCloseTo(shapeBox.right + PAD_GAP, 0);
});

test("where the free area is smaller than the pad, its top left corner wins", async () => {
  await page.viewport(WIDGET.width, WIDGET.height);
  const tinyInsets = { top: 200, right: WIDGET.width - 40, bottom: 260, left: 24 };
  const { container, modeler } = mountHost(
    { left: 0, top: 0, ...WIDGET },
    { insets: () => tinyInsets },
  );
  modeler.importDocument(oneTeamDocument());
  moveTeamTo(modeler, { x: 200, y: 200 });

  select(modeler, CORNER_TEAM);
  await settle();

  const padBox = boxIn(openPad(container), container);
  expect(padBox.height).toBeGreaterThan(WIDGET.height - tinyInsets.top - tinyInsets.bottom);
  expect(padBox.width).toBeGreaterThan(WIDGET.width - tinyInsets.left - tinyInsets.right);
  expect(padBox.left).toBeCloseTo(tinyInsets.left, 0);
  expect(padBox.top).toBeCloseTo(tinyInsets.top, 0);
});

test("at 50 % a corner shape's pad flips with the gap scaled to the zoom", async () => {
  await page.viewport(WIDGET.width, WIDGET.height);
  const { host, container, modeler } = mountHost(
    { left: 0, top: 0, ...WIDGET },
    { insets: () => WIDGET_INSETS },
  );
  addZoomGroup(host);
  modeler.importDocument(oneTeamDocument());
  moveTeamToBottomRight(modeler, 0.5);
  expect(modeler.get<Canvas>("canvas").zoom()).toBeCloseTo(0.5, 3);

  select(modeler, CORNER_TEAM);
  await settle();

  const pad = openPad(container);
  const padBox = boxIn(pad, container);
  expectInside(padBox, WIDGET, WIDGET_INSETS);
  expect(padBox.right).toBeCloseTo(
    boxIn(graphicsOf(modeler, CORNER_TEAM), container).left - PAD_GAP * 0.5,
    0,
  );
  expectEveryEntryReachable(pad);
});

test("a pad keeps inside the container when the host resizes it without moving the view", async () => {
  await page.viewport(1280, 800);
  const wide = { width: 900, height: 520 };
  const narrow = { width: 690, height: 520 };
  const { host, container, modeler } = mountHost({ left: 0, top: 0, ...wide });
  modeler.importDocument(oneTeamDocument());
  moveTeamTo(modeler, { x: 500, y: 200 });
  select(modeler, CORNER_TEAM);
  await settle();

  const canvas = modeler.get<Canvas>("canvas");
  const shapeBox = boxIn(graphicsOf(modeler, CORNER_TEAM), container);
  const besideShape = shapeBox.right + PAD_GAP;
  expect(boxIn(openPad(container), container).left).toBeCloseTo(besideShape, 0);
  expect(besideShape + openPad(container).offsetWidth).toBeGreaterThan(narrow.width);

  // As the shell's viewport does: the view stays, only the container changes.
  host.style.width = `${narrow.width}px`;
  canvas.resized();
  await settle();

  const pad = openPad(container);
  expectInside(boxIn(pad, container), narrow, NO_INSETS);
  expectEveryEntryReachable(pad);

  host.style.width = `${wide.width}px`;
  canvas.resized();
  await settle();

  expect(boxIn(openPad(container), container).left).toBeCloseTo(besideShape, 0);
});

test("a shape under a side panel keeps its pad at the free area's edge, not beside it", async () => {
  await page.viewport(WIDGET.width, WIDGET.height);
  // An open side panel, such as the shell's inspector, widens the right inset past the shape.
  const sidePanelInsets = { ...WIDGET_INSETS, right: 324 };
  const { container, modeler } = mountHost(
    { left: 0, top: 0, ...WIDGET },
    { insets: () => sidePanelInsets },
  );
  modeler.importDocument(oneTeamDocument());
  moveTeamToBottomRight(modeler);

  select(modeler, CORNER_TEAM);
  await settle();

  expectInside(boxIn(openPad(container), container), WIDGET, sidePanelInsets);
});

test("an annotation connector's pad flips around its end point inside the free area", async () => {
  await page.viewport(WIDGET.width, WIDGET.height);
  const { host, container, modeler } = mountHost(
    { left: 0, top: 0, ...WIDGET },
    { insets: () => WIDGET_INSETS },
  );
  addZoomGroup(host);
  modeler.importDocument({
    ...oneTeamDocument(),
    annotations: [
      {
        id: "note_corner",
        text: "Owns the corner",
        position: { x: -260, y: -120 },
        size: { width: 120, height: 40 },
        attachedTo: CORNER_TEAM,
      },
    ],
  });
  moveTeamToBottomRight(modeler);
  const connector = modeler
    .get<ElementRegistry>("elementRegistry")
    .filter((element) => "waypoints" in element)[0];
  expect(connector).toBeDefined();

  select(modeler, connector!.id);
  await settle();

  const pad = openPad(container);
  expectInside(boxIn(pad, container), WIDGET, WIDGET_INSETS);
  expectEveryEntryReachable(pad);
});

async function hoverPaletteEntry(container: HTMLElement, action: string) {
  const entry = container.querySelector<HTMLElement>(
    `.djs-palette .entry[data-action="${action}"]`,
  );
  if (!entry) throw new Error(`No palette entry ${action}.`);
  await userEvent.hover(entry);
  const title = entry.getAttribute("title") ?? "";
  const tooltip = await vi.waitFor(() => {
    const shown = container.querySelector<HTMLElement>(".djs-hover-tooltip");
    if (!shown || !shown.textContent?.includes(title)) throw new Error("No tooltip yet.");
    return shown;
  });
  return { entry, tooltip };
}

/** Guide §5.6: centred on the entry, shifted to keep 12px from the container's sides. */
function expectedTooltipLeft(entryBox: DOMRect, tooltipWidth: number, containerWidth: number) {
  const centred = entryBox.left + entryBox.width / 2 - tooltipWidth / 2;
  return Math.max(
    CONTAINER_EDGE,
    Math.min(centred, containerWidth - CONTAINER_EDGE - tooltipWidth),
  );
}

test("at 720 × 520 a palette tooltip stands below the second-row palette, centred on its entry", async () => {
  await page.viewport(WIDGET.width, WIDGET.height);
  const { container, modeler } = mountHost({ left: 0, top: 0, ...WIDGET });
  modeler.importDocument(oneTeamDocument());

  for (const action of ["lasso-tool", "annotation"]) {
    const { entry, tooltip } = await hoverPaletteEntry(container, action);
    const paletteBox = boxIn(container.querySelector<HTMLElement>(".djs-palette")!, container);
    const entryBox = boxIn(entry, container);
    const tooltipBox = boxIn(tooltip, container);
    expect(paletteBox.top).toBe(64);
    expect(tooltipBox.top).toBeCloseTo(paletteBox.bottom + PALETTE_GAP, 0);
    expect(tooltipBox.left + tooltipBox.width / 2).toBeCloseTo(
      entryBox.left + entryBox.width / 2,
      0,
    );
    await userEvent.unhover(entry);
  }
});

test("in a narrow container inside a wide page the tooltip follows the container, not the page", async () => {
  await page.viewport(1280, 800);
  const narrow = { left: 600, top: 100, width: 360, height: 480 };
  const { container, modeler } = mountHost(narrow);
  modeler.importDocument(oneTeamDocument());

  const paletteBox = boxIn(container.querySelector<HTMLElement>(".djs-palette")!, container);
  // The container is narrow, the page is not: the palette still takes the second row.
  expect(paletteBox.top).toBe(64);

  for (const action of ["lasso-tool", "team.platform"]) {
    const { entry, tooltip } = await hoverPaletteEntry(container, action);
    const tooltipBox = boxIn(tooltip, container);
    expect(tooltipBox.top).toBeCloseTo(paletteBox.bottom + PALETTE_GAP, 0);
    expect(tooltipBox.left).toBeCloseTo(
      expectedTooltipLeft(boxIn(entry, container), tooltipBox.width, narrow.width),
      0,
    );
    expect(tooltipBox.left).toBeGreaterThanOrEqual(CONTAINER_EDGE - 0.5);
    expect(tooltipBox.right).toBeLessThanOrEqual(narrow.width - CONTAINER_EDGE + 0.5);
    await userEvent.unhover(entry);
  }

  // The first entry sits so close to the container's left edge that its tooltip has to shift.
  const { entry, tooltip } = await hoverPaletteEntry(container, "lasso-tool");
  const entryBox = boxIn(entry, container);
  const tooltipBox = boxIn(tooltip, container);
  expect(entryBox.left + entryBox.width / 2 - tooltipBox.width / 2).toBeLessThan(CONTAINER_EDGE);
  expect(tooltipBox.left).toBeCloseTo(CONTAINER_EDGE, 0);
});

test("in a narrow container the last visible entry's tooltip keeps 12px from the right edge", async () => {
  await page.viewport(1280, 800);
  const narrow = { left: 600, top: 100, width: 360, height: 480 };
  const { container, modeler } = mountHost(narrow);
  modeler.importDocument(oneTeamDocument());

  const paletteBox = boxIn(container.querySelector<HTMLElement>(".djs-palette")!, container);
  const lastVisibleEntry = [...container.querySelectorAll<HTMLElement>(".djs-palette .entry")]
    .filter((entry) => boxIn(entry, container).right <= paletteBox.right)
    .at(-1);
  const action = lastVisibleEntry?.getAttribute("data-action");
  if (!action) throw new Error("No palette entry is fully visible.");

  const { entry, tooltip } = await hoverPaletteEntry(container, action);
  const entryBox = boxIn(entry, container);
  const tooltipBox = boxIn(tooltip, container);
  const rightEdge = narrow.width - CONTAINER_EDGE;
  expect(entryBox.left + entryBox.width / 2 + tooltipBox.width / 2).toBeGreaterThan(rightEdge);
  expect(tooltipBox.right).toBeCloseTo(rightEdge, 0);
  expect(tooltipBox.top).toBeCloseTo(paletteBox.bottom + PALETTE_GAP, 0);
});

test("in a wide container the tooltip stands below the top-row palette, centred on its entry", async () => {
  await page.viewport(1280, 800);
  const { container, modeler } = mountHost({ left: 100, top: 50, width: 1000, height: 600 });
  modeler.importDocument(oneTeamDocument());

  const { entry, tooltip } = await hoverPaletteEntry(container, "flow");
  const paletteBox = boxIn(container.querySelector<HTMLElement>(".djs-palette")!, container);
  const entryBox = boxIn(entry, container);
  const tooltipBox = boxIn(tooltip, container);
  expect(paletteBox.top).toBe(12);
  expect(tooltipBox.top).toBeCloseTo(60, 0);
  expect(tooltipBox.left + tooltipBox.width / 2).toBeCloseTo(entryBox.left + entryBox.width / 2, 0);
});

/** A palette entry with a shortcut, so its tooltip shows the chip the Team Topologies tools lack. */
class ShortcutPaletteEntry {
  static $inject = ["palette"];

  constructor(palette: Palette) {
    palette.registerProvider({
      getPaletteEntries: () => ({
        "shortcut-tool": {
          group: "tools",
          title: "Hand",
          shortcut: "H",
          action: { click: () => undefined },
        },
      }),
    });
  }
}

function roleColour(container: HTMLElement, role: string): string {
  const probe = document.createElement("span");
  probe.style.color = `var(${role})`;
  container.append(probe);
  const colour = getComputedStyle(probe).color;
  probe.remove();
  return colour;
}

test("the palette tooltip has the chrome tooltip's surface, type and shortcut chip (guide §5.6)", async () => {
  await page.viewport(1280, 800);
  const { container, modeler } = mountHost(
    { left: 0, top: 0, width: 1280, height: 800 },
    undefined,
    [{ __init__: ["shortcutPaletteEntry"], shortcutPaletteEntry: ["type", ShortcutPaletteEntry] }],
  );
  modeler.importDocument(oneTeamDocument());

  const { tooltip } = await hoverPaletteEntry(container, "shortcut-tool");
  const surface = getComputedStyle(tooltip);
  expect({
    fontFamily: surface.fontFamily.split(",")[0],
    fontSize: surface.fontSize,
    fontWeight: surface.fontWeight,
    lineHeight: surface.lineHeight,
    padding: surface.padding,
    borderWidth: surface.borderWidth,
    borderRadius: surface.borderRadius,
    gap: surface.columnGap,
    height: boxIn(tooltip, container).height,
  }).toEqual({
    fontFamily: '"Geist Variable"',
    fontSize: "13px",
    fontWeight: "400",
    lineHeight: "20px",
    padding: "3px 8px",
    borderWidth: "1px",
    borderRadius: "6px",
    gap: "6px",
    height: 28,
  });
  expect(surface.color).toBe(roleColour(container, "--cd-ui-text"));
  expect(surface.backgroundColor).toBe(roleColour(container, "--cd-ui-flaeche-hoch"));
  expect(surface.borderColor).toBe(roleColour(container, "--cd-ui-linie"));

  const chip = getComputedStyle(tooltip.querySelector("kbd")!);
  expect({
    fontFamily: chip.fontFamily.split(",")[0],
    fontSize: chip.fontSize,
    fontWeight: chip.fontWeight,
    padding: chip.padding,
    borderWidth: chip.borderWidth,
    borderRadius: chip.borderRadius,
    boxShadow: chip.boxShadow,
  }).toEqual({
    fontFamily: '"Geist Mono Variable"',
    fontSize: "13px",
    fontWeight: "400",
    padding: "1px 6px",
    borderWidth: "1px",
    borderRadius: "6px",
    boxShadow: "none",
  });
  expect(chip.color).toBe(roleColour(container, "--cd-ui-text-leise"));
  expect(chip.backgroundColor).toBe(roleColour(container, "--cd-ui-grund"));
  expect(chip.borderColor).toBe(roleColour(container, "--cd-ui-linie"));
});
