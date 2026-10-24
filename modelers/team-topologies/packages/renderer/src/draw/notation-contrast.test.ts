import { describe, expect, it } from "vitest";
import {
  ALL_INTERACTION_SPECS,
  ALL_TEAM_SPECS,
  FLOW_SPEC,
} from "@miragon/team-topologies-schema-model";
import type { TtElement } from "../model/di-types.js";
import { MIRAGON } from "../theme/index.js";
import vendoredTokens from "../theme/cd-tokens.generated.json";
import { labelLayout } from "./label-layout.js";
import { STROKE_MUTED } from "./styles.js";

const TEXT_CONTRAST = 4.5;
const NON_TEXT_CONTRAST = 3;

const CANVAS_GROUND = vendoredTokens.hell["--cd-ui-grund"];

/**
 * The official Team-Shape-Templates strokes below 3:1 on the canvas ground. They stay as they are
 * for fidelity to the templates, an accepted exception (decided 2026-10-24 in #94) that the design
 * guide records for foreign notation in §10.6 from the release after 1.20.1. Their colours are
 * pinned too, so recolouring one of them fails like any new stroke below 3:1.
 */
const OFFICIAL_STROKES_BELOW_NON_TEXT_CONTRAST: Record<string, string> = {
  "stream-aligned": "#FFD966",
  enabling: "#D09CB7",
  "complicated-subsystem": "#E88814",
  platform: "#6D9EEB",
  "x-as-a-service": "#999696",
  facilitating: "#78996B",
};

type Rgb = readonly [number, number, number];

function rgb(colour: string): Rgb {
  const match = /^#([0-9a-f]{6})$/i.exec(colour);
  if (!match) throw new Error(`expected a six-digit hex colour, got ${colour}`);
  const channel = (offset: number) => parseInt(match[1].slice(offset, offset + 2), 16);
  return [channel(0), channel(2), channel(4)];
}

function composite(colour: string, opacity: number, backdrop: string): Rgb {
  const foreground = rgb(colour);
  const background = rgb(backdrop);
  const mix = (index: 0 | 1 | 2) => foreground[index] * opacity + background[index] * (1 - opacity);
  return [mix(0), mix(1), mix(2)];
}

function relativeLuminance([red, green, blue]: Rgb): number {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

function contrast(first: Rgb, second: Rgb): number {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

function element(fields: Record<string, unknown>): TtElement {
  return { id: "element", x: 0, y: 0, width: 240, height: 96, ...fields } as unknown as TtElement;
}

const teamFills = ALL_TEAM_SPECS.map((spec) => [`the ${spec.type} team`, spec.fill] as const);

// Interactions are translucent and sit across team boundaries, so their labels can land on the
// ground, on an exported SVG's white page or on any team.
const interactionBackdrops = [
  ["the canvas ground", CANVAS_GROUND],
  ["a white page", MIRAGON.weiss],
  ...teamFills,
] as const;

describe("label text on the notation", () => {
  it.each(ALL_TEAM_SPECS.map((spec) => [spec.type, spec] as const))(
    "reaches 4.5:1 on the %s team fill",
    (_type, spec) => {
      const label = labelLayout(element({ ttKind: "team", teamType: spec.type }));
      expect(contrast(rgb(label.fill), rgb(spec.fill))).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    },
  );

  it.each(ALL_INTERACTION_SPECS.map((spec) => [spec.mode, spec] as const))(
    "reaches 4.5:1 on the %s interaction fill over every backdrop",
    (_mode, spec) => {
      const label = labelLayout(element({ ttKind: "interaction", mode: spec.mode }));
      for (const [backdropName, backdrop] of interactionBackdrops) {
        const fill = composite(spec.fill, spec.opacity, backdrop);
        expect(contrast(rgb(label.fill), fill), `over ${backdropName}`).toBeGreaterThanOrEqual(
          TEXT_CONTRAST,
        );
      }
    },
  );

  it.each(["flow", "annotation"])("reaches 4.5:1 for a %s on the canvas ground", (ttKind) => {
    const label = labelLayout(element({ ttKind }));
    expect(contrast(rgb(label.fill), rgb(CANVAS_GROUND))).toBeGreaterThanOrEqual(TEXT_CONTRAST);
  });
});

describe("structural strokes on the canvas ground", () => {
  const strokes: ReadonlyArray<readonly [string, string]> = [
    ...ALL_TEAM_SPECS.map((spec) => [spec.type, spec.stroke] as const),
    ...ALL_INTERACTION_SPECS.map((spec) => [spec.mode, spec.stroke] as const),
    ["flow of change", FLOW_SPEC.stroke],
    ["annotation bracket and association", STROKE_MUTED],
  ];

  it("reach 3:1, except exactly the official Team-Shape-Templates strokes below it", () => {
    const below = Object.fromEntries(
      strokes
        .filter(([, stroke]) => contrast(rgb(stroke), rgb(CANVAS_GROUND)) < NON_TEXT_CONTRAST)
        .map(([name, stroke]) => [name, stroke.toUpperCase()]),
    );
    expect(below).toEqual(OFFICIAL_STROKES_BELOW_NON_TEXT_CONTRAST);
  });
});
