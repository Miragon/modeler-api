import { afterEach, describe, expect, test } from "vitest";
import type CommandStack from "diagram-js/lib/command/CommandStack";
import type Canvas from "diagram-js/lib/core/Canvas";
import type ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import type Modeling from "diagram-js/lib/features/modeling/Modeling";
import type { Shape } from "diagram-js/lib/model/Types";
import {
  Modeler,
  NavigatedViewer,
  Viewer,
  createCollaborativeModeler,
  createCollaborativeViewer,
  isCmContext,
  isCmRelationship,
  type CmBaseViewer,
  type CmElementFactory,
  type CmViewerOptions,
} from "@miragon/context-maps-renderer";
import {
  SAMPLE_DOCUMENT,
  emptyDocument,
  serializeDocumentText,
  type CmDocument,
} from "@miragon/context-maps-schema-model";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const WIDTH = 900;
const HEIGHT = 640;
/** The margins the renderer keeps for its own palette when no host names its chrome. */
const PALETTE_ROOM = { top: 84, right: 56, bottom: 56, left: 56 };
/** The modeler shell's fit insets with the palette in the top row (guide §5.9). */
const SHELL_INSETS = { top: 88, right: 24, bottom: 64, left: 24 };

const wrappers: HTMLElement[] = [];

afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.remove();
});

function host(width = WIDTH, height = HEIGHT): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `position:absolute;left:0;top:0;width:${width}px;height:${height}px`;
  const container = document.createElement("div");
  wrapper.append(container);
  document.body.appendChild(wrapper);
  wrappers.push(wrapper);
  return container;
}

function mount<T extends CmBaseViewer>(
  create: (options: CmViewerOptions) => T,
  doc: CmDocument,
  options: CmViewerOptions = {},
): T {
  const viewer = create({ container: host(), ...options });
  viewer.importDocument(doc);
  return viewer;
}

/** The contexts' box as the document places them: what the canvas draws, without a margin. */
function documentBox(doc: CmDocument): Box {
  const left = Math.min(...doc.contexts.map((context) => context.position.x));
  const top = Math.min(...doc.contexts.map((context) => context.position.y));
  const right = Math.max(...doc.contexts.map((c) => c.position.x + c.size.width));
  const bottom = Math.max(...doc.contexts.map((c) => c.position.y + c.size.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function covers(outer: Box, inner: Box): boolean {
  return (
    outer.x <= inner.x &&
    outer.y <= inner.y &&
    outer.x + outer.width >= inner.x + inner.width &&
    outer.y + outer.height >= inner.y + inner.height
  );
}

function waypointBoxes(viewer: CmBaseViewer): Box[] {
  return viewer
    .get<ElementRegistry>("elementRegistry")
    .getAll()
    .filter(isCmRelationship)
    .map((relationship) => {
      const xs = relationship.waypoints.map((point) => point.x);
      const ys = relationship.waypoints.map((point) => point.y);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
    });
}

/** What the canvas draws of the map at zoom 1, in diagram coordinates. */
function drawnBox(viewer: CmBaseViewer): Box {
  // At zoom 1: Chromium lays SVG text out at the scaled font size, so its box changes with the zoom.
  viewer.get<Canvas>("canvas").zoom(1);
  const registry = viewer.get<ElementRegistry>("elementRegistry");
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const element of registry.getAll()) {
    if (!isCmContext(element) && !isCmRelationship(element)) continue;
    const visual = registry.getGraphics(element).querySelector<SVGGraphicsElement>(".djs-visual")!;
    const box = visual.getBBox();
    const origin = isCmContext(element) ? { x: element.x, y: element.y } : { x: 0, y: 0 };
    left = Math.min(left, origin.x + box.x);
    top = Math.min(top, origin.y + box.y);
    right = Math.max(right, origin.x + box.x + box.width);
    bottom = Math.max(bottom, origin.y + box.y + box.height);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Each side of `reported` within `tolerance` of the drawing's: it covers what is drawn (up to text
 * metrics) and adds no margin (the box's 2px stroke is drawn 1px inside it).
 */
function expectTightAround(reported: Box | undefined, drawn: Box, tolerance = 1.5): void {
  expect(reported).toBeDefined();
  expect(Math.abs(reported!.x - drawn.x)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(reported!.y - drawn.y)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(reported!.x + reported!.width - (drawn.x + drawn.width))).toBeLessThanOrEqual(
    tolerance,
  );
  expect(Math.abs(reported!.y + reported!.height - (drawn.y + drawn.height))).toBeLessThanOrEqual(
    tolerance,
  );
}

/** A team row and a type's name wider than their contexts, which the renderer does not cut. */
function documentWithWideDecorations(): CmDocument {
  const doc = emptyDocument("Wide decorations");
  doc.contexts = [
    {
      id: "experience",
      label: "Experience",
      subdomainType: "core",
      team: "Customer Experience Platform Engineering Squad",
      position: { x: 100, y: 100 },
      size: { width: 200, height: 110 },
    },
    {
      id: "operations",
      label: "Operations",
      subdomainType: "supporting",
      team: "Ops",
      position: { x: 520, y: 119 },
      size: { width: 120, height: 72 },
    },
  ];
  doc.relationships = [
    {
      id: "experience_operations",
      from: "operations",
      to: "experience",
      pattern: "upstream-downstream",
      upstreamRoles: ["OHS", "PL"],
      downstreamRoles: ["ACL"],
    },
  ];
  return doc;
}

/** Where `box` stands in the container under the current viewbox, in screen px. */
function onScreen(viewer: CmBaseViewer, box: Box): Box & { scale: number } {
  const viewbox = viewer.get<Canvas>("canvas").viewbox();
  return {
    x: (box.x - viewbox.x) * viewbox.scale,
    y: (box.y - viewbox.y) * viewbox.scale,
    width: box.width * viewbox.scale,
    height: box.height * viewbox.scale,
    scale: viewbox.scale,
  };
}

describe("contentBounds", () => {
  test("is the tight box around the map's contexts and relationships, undefined while empty", () => {
    const modeler = new Modeler({ container: host() });
    try {
      expect(modeler.contentBounds()).toBeUndefined();
      modeler.get<Canvas>("canvas");
      expect(modeler.contentBounds()).toBeUndefined();

      modeler.importDocument(SAMPLE_DOCUMENT);
      const bounds = modeler.contentBounds();
      expect(bounds).toEqual(documentBox(SAMPLE_DOCUMENT));
      const relationships = waypointBoxes(modeler);
      expect(relationships.length).toBeGreaterThan(0);
      for (const box of relationships) expect(covers(bounds!, box)).toBe(true);

      modeler.importDocument(emptyDocument("Empty"));
      expect(modeler.contentBounds()).toBeUndefined();
    } finally {
      modeler.destroy();
    }
    expect(modeler.contentBounds()).toBeUndefined();
    expect(modeler.container.isConnected).toBe(false);
  });

  test("reads the live canvas: a created or moved context counts at once, undo takes it back", () => {
    const modeler = mount((options) => new Modeler(options), SAMPLE_DOCUMENT);
    try {
      const imported = documentBox(SAMPLE_DOCUMENT);
      const context = modeler
        .get<CmElementFactory>("cmElementFactory")
        .createNewContext("core", "Far away");
      const farRight = imported.x + imported.width + 400;
      modeler
        .get<Modeling>("modeling")
        .createShape(
          context as unknown as Shape,
          { x: farRight, y: imported.y - 300 },
          modeler.get<Canvas>("canvas").getRootElement() as Shape,
        );
      expect(modeler.contentBounds()).toEqual({
        x: imported.x,
        y: imported.y - 300 - context.height / 2,
        width: farRight + context.width / 2 - imported.x,
        height: imported.y + imported.height - (imported.y - 300 - context.height / 2),
      });

      modeler.get<CommandStack>("commandStack").undo();
      expect(modeler.contentBounds()).toEqual(imported);

      const leftmost = modeler.get<ElementRegistry>("elementRegistry").get("ctx_auth") as Shape;
      expect(leftmost.x).toBe(imported.x);
      modeler.get<Modeling>("modeling").moveElements([leftmost], { x: -120, y: 0 });
      expect(modeler.contentBounds()).toEqual({
        ...imported,
        x: imported.x - 120,
        width: imported.width + 120,
      });
    } finally {
      modeler.destroy();
    }
  });

  test("zoom and scroll leave it as it is: diagram coordinates, read from the model", () => {
    const modeler = mount((options) => new Modeler(options), SAMPLE_DOCUMENT);
    try {
      const fitted = modeler.contentBounds();
      const canvas = modeler.get<Canvas>("canvas");
      canvas.zoom(2.5);
      expect(modeler.contentBounds()).toEqual(fitted);
      canvas.viewbox({ x: -3000, y: 1200, width: 2400, height: 1700 });
      expect(modeler.contentBounds()).toEqual(fitted);
      canvas.zoom(0.2);
      expect(modeler.contentBounds()).toEqual(fitted);
    } finally {
      modeler.destroy();
    }
  });

  test("the viewers and both contract mounts report the editor's box", async () => {
    const expected = documentBox(SAMPLE_DOCUMENT);
    const viewer = mount((options) => new Viewer(options), SAMPLE_DOCUMENT);
    const navigated = mount((options) => new NavigatedViewer(options), SAMPLE_DOCUMENT);
    const editor = createCollaborativeModeler();
    const readOnly = createCollaborativeViewer();
    try {
      expect(viewer.contentBounds()).toEqual(expected);
      expect(navigated.contentBounds()).toEqual(expected);
      for (const mount of [editor, readOnly]) {
        mount.attachTo(host());
        expect(mount.contentBounds()).toBeUndefined();
        await mount.importText(serializeDocumentText(SAMPLE_DOCUMENT));
        expect(mount.contentBounds()).toEqual(expected);
        expect(mount.contentBounds()).toEqual(mount.diagram.contentBounds());
      }
    } finally {
      viewer.destroy();
      navigated.destroy();
      editor.destroy();
      readOnly.destroy();
    }
    expect(editor.contentBounds()).toBeUndefined();
    expect(readOnly.contentBounds()).toBeUndefined();
  });
});

describe("contentBounds and what the canvas draws", () => {
  test("is the drawing's box, also where a team row or a type's name runs past its context", async () => {
    const doc = documentWithWideDecorations();
    const contexts = documentBox(doc);
    const mounts: CmBaseViewer[] = [
      mount((options) => new Modeler(options), doc),
      mount((options) => new Viewer(options), doc),
      mount((options) => new NavigatedViewer(options), doc),
    ];
    const editor = createCollaborativeModeler();
    const readOnly = createCollaborativeViewer();
    try {
      for (const contract of [editor, readOnly]) {
        contract.attachTo(host());
        await contract.importText(serializeDocumentText(doc));
        mounts.push(contract.diagram);
      }
      for (const viewer of mounts) {
        const reported = viewer.contentBounds();
        expectTightAround(reported, drawnBox(viewer));
        expect(reported!.x).toBeLessThan(contexts.x);
        expect(reported!.x + reported!.width).toBeGreaterThan(contexts.x + contexts.width);
        expect({ y: reported!.y, height: reported!.height }).toEqual({
          y: contexts.y,
          height: contexts.height,
        });
      }
      expect(editor.contentBounds()).toEqual(editor.diagram.contentBounds());
      expect(readOnly.contentBounds()).toEqual(readOnly.diagram.contentBounds());
    } finally {
      for (const viewer of mounts) viewer.destroy();
      editor.destroy();
      readOnly.destroy();
    }
  });

  test("is the drawing's box of the example, chips and markers included", () => {
    const modeler = mount((options) => new Modeler(options), SAMPLE_DOCUMENT);
    try {
      expectTightAround(modeler.contentBounds(), drawnBox(modeler));
    } finally {
      modeler.destroy();
    }
  });

  test("the fit on a phone keeps a team row or type name past its context in the free area", () => {
    const doc = documentWithWideDecorations();
    const phone = { width: 390, height: 700 };
    const modeler = new Modeler({
      container: host(phone.width, phone.height),
      freeArea: { insets: () => SHELL_INSETS },
    });
    try {
      modeler.importDocument(doc);
      const drawn = drawnBox(modeler);
      modeler.importDocument(doc);
      const shown = onScreen(modeler, drawn);
      expect(shown.scale).toBeLessThan(1);
      expect(shown.x).toBeGreaterThanOrEqual(SHELL_INSETS.left - 1);
      expect(shown.x + shown.width).toBeLessThanOrEqual(phone.width - SHELL_INSETS.right + 1);
    } finally {
      modeler.destroy();
    }
  });
});

describe("the fit after an import", () => {
  test("centres the tight content box in the room the renderer's palette needs", () => {
    const content = documentBox(SAMPLE_DOCUMENT);
    const freeWidth = WIDTH - PALETTE_ROOM.left - PALETTE_ROOM.right;
    const freeHeight = HEIGHT - PALETTE_ROOM.top - PALETTE_ROOM.bottom;
    const scale = Math.min(freeWidth / content.width, freeHeight / content.height, 1);
    expect(scale).toBeLessThan(1);
    for (const options of [{}, { freeArea: { center: () => ({ x: 1234, y: 567 }) } }]) {
      const modeler = mount((own) => new Modeler(own), SAMPLE_DOCUMENT, options);
      try {
        const shown = onScreen(modeler, content);
        expect(shown.scale).toBeCloseTo(scale, 3);
        expect(shown.x + shown.width / 2).toBeCloseTo(PALETTE_ROOM.left + freeWidth / 2, 0);
        expect(shown.y + shown.height / 2).toBeCloseTo(PALETTE_ROOM.top + freeHeight / 2, 0);
      } finally {
        modeler.destroy();
      }
    }
  });

  test("centres it in the free rectangle a host's insets leave", () => {
    const content = documentBox(SAMPLE_DOCUMENT);
    const freeWidth = WIDTH - SHELL_INSETS.left - SHELL_INSETS.right;
    const freeHeight = HEIGHT - SHELL_INSETS.top - SHELL_INSETS.bottom;
    const modeler = mount((options) => new Modeler(options), SAMPLE_DOCUMENT, {
      freeArea: { insets: () => SHELL_INSETS },
    });
    try {
      const shown = onScreen(modeler, content);
      expect(shown.scale).toBeCloseTo(
        Math.min(freeWidth / content.width, freeHeight / content.height, 1),
        3,
      );
      expect(shown.x + shown.width / 2).toBeCloseTo(SHELL_INSETS.left + freeWidth / 2, 0);
      expect(shown.y + shown.height / 2).toBeCloseTo(SHELL_INSETS.top + freeHeight / 2, 0);
    } finally {
      modeler.destroy();
    }
  });
});
