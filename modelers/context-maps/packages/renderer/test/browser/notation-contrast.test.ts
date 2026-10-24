import { expect, test } from "vitest";
import { Modeler } from "@miragon/context-maps-renderer";
import { emptyDocument, type CmDocument } from "@miragon/context-maps-schema-model";
import vendoredTokens from "../../src/theme/cd-tokens.generated.json";
import {
  NON_TEXT_CONTRAST,
  TEXT_CONTRAST,
  composite,
  pairBelow,
  type Rgb,
} from "../support/contrast.js";

/** Guide §10.6: a line is measured against the resting surface, on the canvas the ground. */
const CANVAS_GROUND = vendoredTokens.hell["--cd-ui-grund"];

/** The decided colours (#102), as computed. */
const COMPUTED = {
  schwarz: "rgb(29, 29, 29)",
  weiss: "rgb(255, 255, 255)",
  textLeise: "rgb(107, 102, 102)",
};

function mount(): { modeler: Modeler; container: HTMLDivElement } {
  const container = document.createElement("div");
  container.style.width = "1200px";
  container.style.height = "800px";
  document.body.appendChild(container);
  return { modeler: new Modeler({ container, width: 1200, height: 800 }), container };
}

function context(
  id: string,
  x: number,
  y: number,
  fields: Partial<CmDocument["contexts"][number]> = {},
): CmDocument["contexts"][number] {
  return {
    id,
    label: id,
    team: `Team ${id}`,
    position: { x, y },
    size: { width: 200, height: 110 },
    ...fields,
  };
}

/** Every subdomain type, an unclassified and a dark custom context, every pattern and role. */
function everyNotation(): CmDocument {
  const doc = emptyDocument("Every notation");
  doc.contexts = [
    context("core", 40, 40, { subdomainType: "core" }),
    context("supporting", 440, 40, { subdomainType: "supporting" }),
    context("generic", 840, 40, { subdomainType: "generic" }),
    context("plain", 40, 400),
    context("dark", 440, 400, { subdomainType: "generic", fill: "#333333" }),
    context("second-core", 840, 400, { subdomainType: "core" }),
  ];
  doc.relationships = [
    { id: "partnership", from: "core", to: "supporting", pattern: "partnership" },
    { id: "shared-kernel", from: "supporting", to: "generic", pattern: "shared-kernel" },
    { id: "separate-ways", from: "plain", to: "dark", pattern: "separate-ways" },
    {
      id: "upstream-downstream",
      from: "core",
      to: "plain",
      pattern: "upstream-downstream",
      upstreamRoles: ["OHS", "PL"],
      downstreamRoles: ["ACL"],
    },
    {
      id: "conformist",
      from: "generic",
      to: "second-core",
      pattern: "upstream-downstream",
      upstreamRoles: ["OHS"],
      downstreamRoles: ["CF"],
    },
    {
      id: "customer-supplier",
      from: "dark",
      to: "second-core",
      pattern: "customer-supplier",
      upstreamRoles: ["PL"],
      downstreamRoles: ["ACL"],
    },
  ];
  return doc;
}

function visualOf(container: HTMLElement, id: string): SVGGElement {
  const visual = container.querySelector<SVGGElement>(`[data-element-id="${id}"] .djs-visual`);
  expect(visual, `visual of "${id}"`).not.toBeNull();
  return visual!;
}

/** tiny-svg writes paint as inline style, so the computed value is what the canvas shows. */
function paint(element: Element, property: "fill" | "stroke"): string {
  return getComputedStyle(element)[property];
}

/** What a shape shows: its fill, mixed over `backdrop` when it is translucent. */
function surfaceOf(shape: Element, backdrop: string): Rgb {
  const style = getComputedStyle(shape);
  return composite(style.fill, Number(style.fillOpacity), backdrop);
}

/** A context: every text on the box, the subdomain glyph on the box, the outline on the ground. */
function contextFailures(visual: SVGGElement, id: string): string[] {
  const box = visual.querySelector("rect")!;
  const fill = paint(box, "fill");
  const pairs = [
    pairBelow(`${id} outline`, paint(box, "stroke"), CANVAS_GROUND, NON_TEXT_CONTRAST),
  ];
  for (const text of visual.querySelectorAll("text")) {
    const name = `${id} text "${text.textContent}"`;
    pairs.push(pairBelow(name, paint(text, "fill"), fill, TEXT_CONTRAST));
  }
  for (const glyph of visual.querySelectorAll(":scope > g:not(.cm-team)")) {
    for (const shape of glyph.querySelectorAll("path, circle")) {
      const colour = paint(shape, shape.tagName === "circle" ? "stroke" : "fill");
      pairs.push(pairBelow(`${id} glyph`, colour, fill, NON_TEXT_CONTRAST));
    }
  }
  return pairs.filter((pair): pair is string => pair !== undefined);
}

/**
 * The boxes a relationship draws: a symmetric pattern's chip, whose border is a line; an
 * integration role's chip, one filled area named by its text; the decorative `linie` frame
 * around the role chips.
 */
const CHIP_KINDS = {
  pattern: "cm-pattern-chip",
  role: "cm-role-chip",
  frame: "cm-role-frame",
} as const;

function chipsOf(visual: SVGGElement, kind: keyof typeof CHIP_KINDS): SVGRectElement[] {
  return [...visual.querySelectorAll<SVGRectElement>(`rect.${CHIP_KINDS[kind]}`)];
}

/**
 * A relationship: the line and each pattern chip's border on the ground; a chip's text on the chip
 * it sits in (a translucent chip over the line under it), a direction letter on its paper halo.
 */
function relationshipFailures(visual: SVGGElement, id: string): string[] {
  const line = visual.querySelector("polyline")!;
  const lineColour = paint(line, "stroke");
  const pairs = [pairBelow(`${id} line`, lineColour, CANVAS_GROUND, NON_TEXT_CONTRAST)];
  for (const chip of chipsOf(visual, "pattern")) {
    pairs.push(
      pairBelow(`${id} chip border`, paint(chip, "stroke"), CANVAS_GROUND, NON_TEXT_CONTRAST),
    );
  }
  for (const text of visual.querySelectorAll("text")) {
    const name = `${id} text "${text.textContent}"`;
    const style = getComputedStyle(text);
    const haloed = style.paintOrder.startsWith("stroke") && style.stroke !== "none";
    const chip = text.previousElementSibling;
    if (!haloed) {
      expect(chip?.matches(".cm-pattern-chip, .cm-role-chip"), `${name} sits on a chip`).toBe(true);
    }
    const surface = haloed ? style.stroke : surfaceOf(chip!, lineColour);
    pairs.push(pairBelow(name, style.fill, surface, TEXT_CONTRAST));
  }
  return pairs.filter((pair): pair is string => pair !== undefined);
}

test("every text the canvas draws reaches 4.5:1 and every line 3:1, with no exception", () => {
  const { modeler, container } = mount();
  try {
    const doc = everyNotation();
    modeler.importDocument(doc);
    const relationships = doc.relationships.map(({ id }) => visualOf(container, id));
    const count = (kind: keyof typeof CHIP_KINDS) =>
      relationships.reduce((sum, visual) => sum + chipsOf(visual, kind).length, 0);
    expect({ pattern: count("pattern"), role: count("role"), frame: count("frame") }).toEqual({
      pattern: 3,
      role: 7,
      frame: 6,
    });
    for (const visual of relationships) {
      expect(visual.querySelectorAll("rect").length, "every box is a known chip").toBe(
        chipsOf(visual, "pattern").length +
          chipsOf(visual, "role").length +
          chipsOf(visual, "frame").length,
      );
    }
    const failures = [
      ...doc.contexts.flatMap(({ id }) => contextFailures(visualOf(container, id), id)),
      ...doc.relationships.flatMap(({ id }) => relationshipFailures(visualOf(container, id), id)),
    ];
    expect(failures).toEqual([]);
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("the subdomain badge and its glyph are text-leise, black or white on a fill the author set", () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(everyNotation());
    const badgeColours = (id: string) => {
      const visual = visualOf(container, id);
      const badge = [...visual.querySelectorAll("text")].find((text) =>
        /Domain|Subdomain/.test(text.textContent ?? ""),
      );
      expect(badge, `badge of "${id}"`).toBeDefined();
      const glyph = visual.querySelector(":scope > g:not(.cm-team) :is(path, circle)")!;
      return [paint(badge!, "fill"), paint(glyph, glyph.tagName === "circle" ? "stroke" : "fill")];
    };
    for (const id of ["core", "supporting", "generic"]) {
      expect(badgeColours(id), id).toEqual([COMPUTED.textLeise, COMPUTED.textLeise]);
    }
    expect(badgeColours("dark")).toEqual([COMPUTED.weiss, COMPUTED.weiss]);
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("the role chips write in black or white, whichever reads better on the chip", () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(everyNotation());
    const textColours: Record<string, string> = {};
    for (const id of ["upstream-downstream", "conformist"]) {
      for (const chip of chipsOf(visualOf(container, id), "role")) {
        const text = chip.nextElementSibling!;
        expect(paint(chip, "stroke"), `${text.textContent} has no border of its own`).toBe(
          paint(chip, "fill"),
        );
        textColours[text.textContent!] = paint(text, "fill");
      }
    }
    expect(textColours).toEqual({
      OHS: COMPUTED.weiss,
      PL: COMPUTED.schwarz,
      ACL: COMPUTED.weiss,
      CF: COMPUTED.schwarz,
    });
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("a symmetric pattern's chip writes in black on paper, bordered in the pattern's colour", () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(everyNotation());
    for (const id of ["partnership", "shared-kernel", "separate-ways"]) {
      const visual = visualOf(container, id);
      const chips = chipsOf(visual, "pattern");
      expect(chips, id).toHaveLength(1);
      const chip = chips[0];
      expect(paint(chip.nextElementSibling!, "fill"), id).toBe(COMPUTED.schwarz);
      expect(paint(chip, "fill"), id).toBe(COMPUTED.weiss);
      expect(paint(chip, "stroke"), id).toBe(paint(visual.querySelector("polyline")!, "stroke"));
    }
  } finally {
    modeler.destroy();
    container.remove();
  }
});
