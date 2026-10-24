import { expect, test } from "vitest";
import { Modeler, isCmContext } from "@miragon/context-maps-renderer";
import type { CmContext, CmLabelEditing } from "@miragon/context-maps-renderer";
import { emptyDocument, type CmDocument } from "@miragon/context-maps-schema-model";

/** Guide §3.2 and §10.1: the token values the canvas draws its own neutrals in, as computed. */
const TOKEN = {
  weiss: "rgb(255, 255, 255)",
  schwarz: "rgb(29, 29, 29)",
  linie: "rgb(230, 226, 226)",
  kontur: "rgb(143, 138, 138)",
  textLeise: "rgb(107, 102, 102)",
};

/** The geometry of Lucide `users` (lucide-static 1.59.0): three paths and the head circle. */
const LUCIDE_USERS = [
  "path:M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
  "path:M16 3.128a4 4 0 0 1 0 7.744",
  "path:M22 21v-2a4 4 0 0 0-3-3.87",
  "circle:9,7,4",
];

function mount(): { modeler: Modeler; container: HTMLDivElement } {
  const container = document.createElement("div");
  container.style.width = "1000px";
  container.style.height = "700px";
  document.body.appendChild(container);
  return { modeler: new Modeler({ container, width: 1000, height: 700 }), container };
}

function colourfulMap(): CmDocument {
  const doc = emptyDocument("Colours");
  doc.contexts = [
    {
      id: "plain",
      label: "Unclassified",
      team: "Team Grey",
      position: { x: 40, y: 40 },
      size: { width: 200, height: 110 },
    },
    {
      id: "core",
      label: "Billing",
      subdomainType: "core",
      team: "Team Blue",
      position: { x: 320, y: 40 },
      size: { width: 200, height: 110 },
    },
    {
      id: "dark",
      label: "Night shift",
      subdomainType: "generic",
      team: "Team Dark",
      fill: "#333333",
      position: { x: 600, y: 40 },
      size: { width: 200, height: 110 },
    },
    {
      id: "light",
      label: "Light fill",
      subdomainType: "supporting",
      team: "Team Light",
      fill: "#FFFFFF",
      position: { x: 320, y: 400 },
      size: { width: 200, height: 110 },
    },
  ];
  doc.relationships = [
    {
      id: "roles",
      from: "core",
      to: "light",
      pattern: "upstream-downstream",
      upstreamRoles: ["OHS", "PL"],
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

function contextById(modeler: Modeler, id: string): CmContext {
  const registry = modeler.get<{ getAll(): unknown[] }>("elementRegistry");
  return registry
    .getAll()
    .filter(isCmContext)
    .find((context) => context.id === id)!;
}

/** tiny-svg writes paint as inline style, so the computed value is what the canvas shows. */
function paint(element: Element, property: "fill" | "stroke"): string {
  return getComputedStyle(element)[property];
}

function nameColours(visual: SVGGElement): string[] {
  return [...visual.querySelectorAll("text.cm-name")].map((line) => paint(line, "fill"));
}

function teamParts(visual: SVGGElement): { glyph: SVGGElement; caption: SVGTextElement } {
  const glyph = visual.querySelector<SVGGElement>("g.cm-team");
  const caption = visual.querySelector<SVGTextElement>("text.cm-team");
  expect(glyph, "team glyph").not.toBeNull();
  expect(caption, "team caption").not.toBeNull();
  return { glyph: glyph!, caption: caption! };
}

function shapesOf(glyph: SVGGElement): string[] {
  return [...glyph.children].map((shape) =>
    shape.tagName === "circle"
      ? `circle:${["cx", "cy", "r"].map((name) => shape.getAttribute(name)).join(",")}`
      : `${shape.tagName}:${shape.getAttribute("d")}`,
  );
}

test("an unclassified context is a white box with a contour in --cd-kontur", () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(colourfulMap());
    const box = visualOf(container, "plain").querySelector("rect")!;
    expect(paint(box, "fill")).toBe(TOKEN.weiss);
    expect(paint(box, "stroke")).toBe(TOKEN.kontur);
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("the team glyph is Lucide users, stroked like the caption in --cd-text-leise, never filled", () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(colourfulMap());
    for (const id of ["plain", "core"]) {
      const { glyph, caption } = teamParts(visualOf(container, id));
      expect(paint(caption, "fill"), id).toBe(TOKEN.textLeise);
      expect(shapesOf(glyph), id).toEqual(LUCIDE_USERS);
      for (const shape of glyph.children) {
        const style = getComputedStyle(shape);
        expect(style.fill, `${id} ${shape.tagName}`).toBe("none");
        expect(style.stroke, `${id} ${shape.tagName}`).toBe(TOKEN.textLeise);
        expect(style.strokeWidth, `${id} ${shape.tagName}`).toBe("2.5px");
        expect(style.strokeLinecap, `${id} ${shape.tagName}`).toBe("round");
      }
    }
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("a context's name, team and glyph are black or white, whichever reads better on its fill", () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(colourfulMap());
    expect(nameColours(visualOf(container, "plain"))).toEqual([TOKEN.schwarz]);
    expect(nameColours(visualOf(container, "core"))).toEqual([TOKEN.schwarz]);

    const dark = visualOf(container, "dark");
    expect(nameColours(dark)).toEqual([TOKEN.weiss]);
    const darkTeam = teamParts(dark);
    expect(paint(darkTeam.caption, "fill")).toBe(TOKEN.weiss);
    expect(paint(darkTeam.glyph, "stroke")).toBe(TOKEN.weiss);

    const light = visualOf(container, "light");
    expect(nameColours(light)).toEqual([TOKEN.schwarz]);
    const lightTeam = teamParts(light);
    expect(paint(lightTeam.caption, "fill")).toBe(TOKEN.schwarz);
    expect(paint(lightTeam.glyph, "stroke")).toBe(TOKEN.schwarz);
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("the label editor writes in the colour the canvas draws the edited text in", () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(colourfulMap());
    const labelEditing = modeler.get<CmLabelEditing>("cmLabelEditing");
    const editorColour = (): string =>
      getComputedStyle(container.querySelector<HTMLElement>(".djs-direct-editing-parent")!).color;

    labelEditing.activate(contextById(modeler, "dark"));
    expect(editorColour()).toBe(TOKEN.weiss);
    labelEditing.cancel();

    labelEditing.activateTeam(contextById(modeler, "dark"));
    expect(editorColour()).toBe(TOKEN.weiss);
    labelEditing.cancel();

    labelEditing.activate(contextById(modeler, "core"));
    expect(editorColour()).toBe(TOKEN.schwarz);
    labelEditing.cancel();

    labelEditing.activateTeam(contextById(modeler, "core"));
    expect(editorColour()).toBe(TOKEN.textLeise);
    labelEditing.cancel();
  } finally {
    modeler.destroy();
    container.remove();
  }
});

test("the role chips sit in a --cd-linie frame, each bordered in its own colour", () => {
  const { modeler, container } = mount();
  try {
    modeler.importDocument(colourfulMap());
    const visual = visualOf(container, "roles");
    const frames = [...visual.querySelectorAll("rect.cm-role-frame")];
    expect(frames).toHaveLength(2);
    for (const frame of frames) expect(paint(frame, "stroke")).toBe(TOKEN.linie);
    const chips = [...visual.querySelectorAll("rect.cm-role-chip")];
    expect(chips).toHaveLength(3);
    for (const chip of chips) expect(paint(chip, "stroke")).toBe(paint(chip, "fill"));
  } finally {
    modeler.destroy();
    container.remove();
  }
});
