import { afterEach, describe, expect, it } from "vitest";
import { attachedHost } from "@miragon/modeler-api/conformance";
import type ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import {
  COLORS,
  createCollaborativeModeler,
  svgToPng,
  type CollaborativeValueChainModeler,
  type VcColorPickerProvider,
  type VcRenderer,
  type VcShape,
} from "../../src/index.js";
import { fest } from "../../src/theme/cd-tokens.generated.json";
import "../../src/assets/value-chain.css";

/**
 * Guide §10.6: a shape's own colour is its fill, the contour stays ink, and the label is black or
 * white, whichever contrasts more with the fill, whatever colour the shape has. A halo in the fill
 * keeps label lines that run past the shape readable (guide §3.7). Colours stored by older
 * versions (the picker's former hsl() accents) or written by hand keep rendering, and the stored
 * value never changes.
 */

const BLACK = fest["--cd-schwarz"];
const WHITE = fest["--cd-weiss"];

interface Case {
  id: string;
  color?: string;
  elementType?: "step" | "orgUnit";
  fill: string;
  label: string;
  /** The label's halo, the fill as it shows over the plot; none on a shape without a colour. */
  halo?: string;
}

const CASES: Case[] = [
  { id: "step-default", fill: COLORS.fill, label: COLORS.ink },
  // the former picker's Blue: black reaches 4.46:1 on it, white only 3.78:1
  {
    id: "step-legacy-blue",
    color: "hsl(205, 100%, 45%)",
    fill: "#0086E6",
    label: BLACK,
    halo: "#0086E6",
  },
  // the former picker's Red: white reaches 4.81:1 on it, black only 3.50:1
  {
    id: "step-legacy-red",
    color: "hsl(360, 100%, 45%)",
    fill: "#E60000",
    label: WHITE,
    halo: "#E60000",
  },
  {
    id: "step-legacy-purple",
    color: "hsl(287, 65%, 44%)",
    fill: "#9A27B9",
    label: WHITE,
    halo: "#9A27B9",
  },
  {
    id: "step-blue",
    color: fest["--cd-blau"],
    fill: fest["--cd-blau"],
    label: WHITE,
    halo: fest["--cd-blau"],
  },
  {
    id: "step-green",
    color: fest["--cd-gruen"],
    fill: fest["--cd-gruen"],
    label: BLACK,
    halo: fest["--cd-gruen"],
  },
  {
    id: "step-amber",
    color: fest["--cd-warning"],
    fill: fest["--cd-warning"],
    label: BLACK,
    halo: fest["--cd-warning"],
  },
  { id: "step-named", color: "navy", fill: "#000080", label: WHITE, halo: "#000080" },
  // syntaxes newer than rgb(), which the canvas hands back as written
  { id: "step-oklch", color: "oklch(0% 0 0)", fill: "#000000", label: WHITE, halo: "#000000" },
  {
    id: "step-color-function",
    color: "color(srgb 0.2 0.4 0.8)",
    fill: "#3366CC",
    label: WHITE,
    halo: "#3366CC",
  },
  // half the blue over the white plot: black reaches 7.78:1 on it, white only 2.17:1
  {
    id: "step-translucent",
    color: "rgba(51, 93, 229, 0.5)",
    fill: "rgba(51, 93, 229, 0.5)",
    label: BLACK,
    halo: "#99AEF2",
  },
  { id: "step-not-a-colour", color: "not a colour", fill: COLORS.fill, label: COLORS.ink },
  {
    id: "org-black",
    color: fest["--cd-schwarz"],
    elementType: "orgUnit",
    fill: fest["--cd-schwarz"],
    label: WHITE,
    halo: fest["--cd-schwarz"],
  },
];

const COLOURED_CHAIN = JSON.stringify({
  connections: [],
  elements: CASES.map((entry, index) => ({
    bounds: { x: (index % 5) * 200, y: Math.floor(index / 5) * 120, width: 160, height: 60 },
    elementType: entry.elementType ?? "step",
    id: entry.id,
    name: entry.id,
    ...(entry.color === undefined ? {} : { color: entry.color }),
  })),
  meta: { name: "Coloured chain" },
  schemaVersion: 1,
});

const mounted: CollaborativeValueChainModeler[] = [];

async function mount(document = COLOURED_CHAIN): Promise<CollaborativeValueChainModeler> {
  const modeler = createCollaborativeModeler();
  modeler.attachTo(attachedHost());
  mounted.push(modeler);
  await modeler.importText(document);
  return modeler;
}

afterEach(() => {
  for (const modeler of mounted.splice(0)) modeler.destroy();
});

/** A colour as the browser computes it, so hex case and notation do not count. */
function computed(color: string): string {
  const probe = document.createElement("span");
  probe.style.color = color;
  document.body.appendChild(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}

function drawn(modeler: CollaborativeValueChainModeler, id: string) {
  const graphics = modeler.diagram.get<ElementRegistry>("elementRegistry").getGraphics(id);
  const outline = graphics.querySelector(".djs-visual > path")!;
  const label = graphics.querySelector(".djs-visual > text")!;
  return {
    fill: getComputedStyle(outline).fill,
    stroke: getComputedStyle(outline).stroke,
    label: getComputedStyle(label).fill,
    halo: getComputedStyle(label).stroke,
  };
}

function storedColors(text: string): Record<string, unknown> {
  const elements = (JSON.parse(text) as { elements: Record<string, unknown>[] }).elements;
  return Object.fromEntries(elements.map((element) => [element["id"], element["color"]]));
}

function shape(modeler: CollaborativeValueChainModeler, id: string): VcShape {
  return modeler.diagram.get<ElementRegistry>("elementRegistry").get(id) as VcShape;
}

describe("a shape's own colour fills it (guide §10.6)", () => {
  it.each(CASES)("$id: fill, ink contour and a black or white label", async (entry) => {
    const modeler = await mount();
    expect(drawn(modeler, entry.id)).toEqual({
      fill: computed(entry.fill),
      stroke: computed(COLORS.ink),
      label: computed(entry.label),
      halo: entry.halo === undefined ? "none" : computed(entry.halo),
    });
  });

  it("keeps every stored value as it was, older hsl() accents included", async () => {
    const modeler = await mount();
    expect(storedColors(modeler.exportText())).toEqual(storedColors(COLOURED_CHAIN));
  });
});

describe("the colour picker (guide §10.6)", () => {
  function entries(modeler: CollaborativeValueChainModeler, id: string) {
    return modeler.diagram
      .get<VcColorPickerProvider>("vcColorPickerProvider")
      .getPopupMenuEntries(shape(modeler, id));
  }

  it('offers "Default", then the palette and status colours, each with its fill as swatch', async () => {
    const modeler = await mount();
    const offered = Object.values(entries(modeler, "step-default"));
    expect(offered.map((entry) => entry.label)).toEqual([
      "Default",
      "Blue",
      "Green",
      "Gray",
      "Black",
      "White",
      "Amber",
      "Red",
    ]);
    const swatchFills = offered.map((entry) => /fill="([^"]+)"/.exec(entry.imageHtml ?? "")?.[1]);
    expect(swatchFills).toEqual([
      COLORS.fill,
      fest["--cd-blau"],
      fest["--cd-gruen"],
      fest["--cd-grau"],
      fest["--cd-schwarz"],
      fest["--cd-weiss"],
      fest["--cd-warning"],
      fest["--cd-danger"],
    ]);
  });

  it("stores the token value, fills the shape with it and clears it again with Default", async () => {
    const modeler = await mount();
    const picker = entries(modeler, "step-legacy-blue");
    picker["color-red"]!.action();
    expect(shape(modeler, "step-legacy-blue").color).toBe(fest["--cd-danger"]);
    expect(drawn(modeler, "step-legacy-blue")).toEqual({
      fill: computed(fest["--cd-danger"]),
      stroke: computed(COLORS.ink),
      label: computed(WHITE),
      halo: computed(fest["--cd-danger"]),
    });

    picker["color-default"]!.action();
    expect(shape(modeler, "step-legacy-blue").color).toBeUndefined();
    expect(drawn(modeler, "step-legacy-blue")).toEqual({
      fill: computed(COLORS.fill),
      stroke: computed(COLORS.ink),
      label: computed(COLORS.ink),
      halo: "none",
    });
    expect(storedColors(modeler.exportText())["step-legacy-blue"]).toBeUndefined();
  });
});

describe("a label that runs past its coloured shape keeps 4.5:1 there (guide §3.7)", () => {
  /** 56 characters: far more lines than a 100×40 shape holds. */
  const LONG_LABEL = "Plan, source and schedule every inbound delivery on time";

  const CRM_LABEL = "Customer relationship management, complaints and after sales support";

  interface Overflow {
    id: string;
    color: string;
    elementType: "step" | "orgUnit";
    width: number;
    height: number;
    name: string;
  }

  const OVERFLOWS: Overflow[] = [
    {
      id: "small-black-step",
      color: fest["--cd-schwarz"],
      elementType: "step",
      width: 100,
      height: 40,
      name: LONG_LABEL,
    },
    {
      id: "small-blue-step",
      color: fest["--cd-blau"],
      elementType: "step",
      width: 100,
      height: 40,
      name: LONG_LABEL,
    },
    {
      id: "default-size-blue-step",
      color: fest["--cd-blau"],
      elementType: "step",
      width: 160,
      height: 60,
      name: CRM_LABEL,
    },
    {
      id: "small-red-org-unit",
      color: fest["--cd-danger"],
      elementType: "orgUnit",
      width: 100,
      height: 40,
      name: LONG_LABEL,
    },
  ];

  const OVERFLOWING_CHAIN = JSON.stringify({
    connections: [],
    elements: OVERFLOWS.map((entry, index) => ({
      bounds: { x: index * 240, y: 100, width: entry.width, height: entry.height },
      elementType: entry.elementType,
      id: entry.id,
      name: entry.name,
      color: entry.color,
    })),
    meta: { name: "Overflowing labels" },
    schemaVersion: 1,
  });

  /** The PNG export's scale. */
  const SCALE = 2;

  /** The contour's half stroke and its anti-aliasing: pixels this close to the shape are not text. */
  const CONTOUR_CLEARANCE = 2;

  type Rgb = [number, number, number];

  interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  function rgb(color: string): Rgb {
    const [red, green, blue] = computed(color).match(/\d+/g)!.map(Number);
    return [red!, green!, blue!];
  }

  function luminance([red, green, blue]: Rgb): number {
    const linear = (channel: number) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
  }

  function contrast(first: Rgb, second: Rgb): number {
    const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
    return (lighter! + 0.05) / (darker! + 0.05);
  }

  function labelBox(modeler: CollaborativeValueChainModeler, id: string): Box {
    return modeler.diagram.get<VcRenderer>("vcRenderer").labelBounds(shape(modeler, id))!;
  }

  /** The parts of the label's box above and below the shape. */
  function pastTheShape(box: Box, element: VcShape): Box[] {
    const above = element.y - CONTOUR_CLEARANCE - box.y;
    const belowTop = element.y + element.height + CONTOUR_CLEARANCE;
    return [
      { x: box.x, y: box.y, width: box.width, height: above },
      { x: box.x, y: belowTop, width: box.width, height: box.y + box.height - belowTop },
    ];
  }

  async function exportedPng(modeler: CollaborativeValueChainModeler) {
    const { svg } = modeler.diagram.saveSVG();
    const [originX, originY] = /viewBox="(\S+) (\S+)/.exec(svg)!.slice(1).map(Number) as [
      number,
      number,
    ];
    const bitmap = await createImageBitmap(await svgToPng(svg, SCALE));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    /** The highest contrast any pixel of the region reaches against the given colour. */
    return function strongestContrast(region: Box, against: Rgb): number {
      let strongest = 1;
      const left = Math.max(0, Math.floor((region.x - originX) * SCALE));
      const right = Math.min(pixels.width, Math.ceil((region.x + region.width - originX) * SCALE));
      const top = Math.max(0, Math.floor((region.y - originY) * SCALE));
      const bottom = Math.min(
        pixels.height,
        Math.ceil((region.y + region.height - originY) * SCALE),
      );
      for (let row = top; row < bottom; row += 1) {
        for (let column = left; column < right; column += 1) {
          const offset = (row * pixels.width + column) * 4;
          const pixel: Rgb = [
            pixels.data[offset]!,
            pixels.data[offset + 1]!,
            pixels.data[offset + 2]!,
          ];
          strongest = Math.max(strongest, contrast(pixel, against));
        }
      }
      return strongest;
    };
  }

  it.each(OVERFLOWS)("$id: the label runs past the shape above and below", async (entry) => {
    const modeler = await mount(OVERFLOWING_CHAIN);
    for (const region of pastTheShape(labelBox(modeler, entry.id), shape(modeler, entry.id))) {
      expect(region.height).toBeGreaterThan(2);
    }
  });

  it.each(OVERFLOWS)("$id: its glyphs carry a halo in the fill", async (entry) => {
    const modeler = await mount(OVERFLOWING_CHAIN);
    const label = modeler.diagram
      .get<ElementRegistry>("elementRegistry")
      .getGraphics(entry.id)
      .querySelector(".djs-visual > text")!;
    const style = getComputedStyle(label);
    expect(style.stroke).toBe(computed(entry.color));
    expect(style.strokeWidth).toBe("3px");
    expect(style.strokeLinejoin).toBe("round");
    expect(style.paintOrder).toBe("stroke");
    expect(contrast(rgb(style.fill), rgb(style.stroke))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(OVERFLOWS)(
    "$id: the PNG export shows the lines past the shape at 4.5:1",
    async (entry) => {
      const modeler = await mount(OVERFLOWING_CHAIN);
      const strongestContrast = await exportedPng(modeler);
      const label = rgb(drawn(modeler, entry.id).label);
      for (const region of pastTheShape(labelBox(modeler, entry.id), shape(modeler, entry.id))) {
        expect(strongestContrast(region, label)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
