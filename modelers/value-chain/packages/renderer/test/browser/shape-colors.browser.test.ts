import { afterEach, describe, expect, it } from "vitest";
import { attachedHost } from "@miragon/modeler-api/conformance";
import type ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import {
  COLORS,
  createCollaborativeModeler,
  type CollaborativeValueChainModeler,
  type VcColorPickerProvider,
  type VcShape,
} from "../../src/index.js";
import { fest } from "../../src/theme/cd-tokens.generated.json";
import "../../src/assets/value-chain.css";

/**
 * Guide §10.6: a shape's own colour is its fill, the contour stays ink, and the label is black or
 * white, whichever contrasts more with the fill, whatever colour the shape has. Colours stored by
 * older versions (the picker's former hsl() accents) or written by hand keep rendering, and the
 * stored value never changes.
 */

const BLACK = fest["--cd-schwarz"];
const WHITE = fest["--cd-weiss"];

interface Case {
  id: string;
  color?: string;
  elementType?: "step" | "orgUnit";
  fill: string;
  label: string;
}

const CASES: Case[] = [
  { id: "step-default", fill: COLORS.fill, label: COLORS.ink },
  // the former picker's Blue: black reaches 4.46:1 on it, white only 3.78:1
  { id: "step-legacy-blue", color: "hsl(205, 100%, 45%)", fill: "#0086E6", label: BLACK },
  // the former picker's Red: white reaches 4.81:1 on it, black only 3.50:1
  { id: "step-legacy-red", color: "hsl(360, 100%, 45%)", fill: "#E60000", label: WHITE },
  { id: "step-legacy-purple", color: "hsl(287, 65%, 44%)", fill: "#9A27B9", label: WHITE },
  { id: "step-blue", color: fest["--cd-blau"], fill: fest["--cd-blau"], label: WHITE },
  { id: "step-green", color: fest["--cd-gruen"], fill: fest["--cd-gruen"], label: BLACK },
  { id: "step-amber", color: fest["--cd-warning"], fill: fest["--cd-warning"], label: BLACK },
  { id: "step-named", color: "navy", fill: "#000080", label: WHITE },
  // half the blue over the white plot: black reaches 7.78:1 on it, white only 2.17:1
  {
    id: "step-translucent",
    color: "rgba(51, 93, 229, 0.5)",
    fill: "rgba(51, 93, 229, 0.5)",
    label: BLACK,
  },
  { id: "step-not-a-colour", color: "not a colour", fill: COLORS.fill, label: COLORS.ink },
  {
    id: "org-black",
    color: fest["--cd-schwarz"],
    elementType: "orgUnit",
    fill: fest["--cd-schwarz"],
    label: WHITE,
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

async function mount(): Promise<CollaborativeValueChainModeler> {
  const modeler = createCollaborativeModeler();
  modeler.attachTo(attachedHost());
  mounted.push(modeler);
  await modeler.importText(COLOURED_CHAIN);
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
      "Black",
      "Amber",
      "Red",
    ]);
    const swatchFills = offered.map((entry) => /fill="([^"]+)"/.exec(entry.imageHtml ?? "")?.[1]);
    expect(swatchFills).toEqual([
      COLORS.fill,
      fest["--cd-blau"],
      fest["--cd-gruen"],
      fest["--cd-schwarz"],
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
    });

    picker["color-default"]!.action();
    expect(shape(modeler, "step-legacy-blue").color).toBeUndefined();
    expect(drawn(modeler, "step-legacy-blue")).toEqual({
      fill: computed(COLORS.fill),
      stroke: computed(COLORS.ink),
      label: computed(COLORS.ink),
    });
    expect(storedColors(modeler.exportText())["step-legacy-blue"]).toBeUndefined();
  });
});
