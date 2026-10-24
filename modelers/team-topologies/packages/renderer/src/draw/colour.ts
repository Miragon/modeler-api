/**
 * Colour arithmetic for the notation: hex parsing, WCAG contrast and the interaction fills mixed
 * over white.
 */

import { INTERACTION_MODE_SPECS } from "@miragon/team-topologies-schema-model";
import type { TtInteraction } from "../model/di-types.js";
import { MIRAGON, PREMIXED_INTERACTION_FILLS } from "../theme/index.js";

export type Rgb = readonly [number, number, number];

export function parseHexColour(colour: unknown): Rgb | undefined {
  if (typeof colour !== "string") return undefined;
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(colour.trim());
  if (!match) return undefined;
  const hex =
    match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join("") : match[1];
  const channel = (offset: number) => parseInt(hex.slice(offset, offset + 2), 16);
  return [channel(0), channel(2), channel(4)];
}

function hexColour(colour: Rgb): string {
  return `#${colour.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function blendOver(colour: Rgb, backdrop: Rgb, opacity: number): Rgb {
  const mix = (index: 0 | 1 | 2) =>
    Math.round(colour[index] * opacity + backdrop[index] * (1 - opacity));
  return [mix(0), mix(1), mix(2)];
}

function relativeLuminance([red, green, blue]: Rgb): number {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

export function contrastRatio(first: Rgb, second: Rgb): number {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * `fill` at `opacity` over white, as one opaque colour, or `undefined` for a value that is not a hex
 * colour. Guide §10.6 draws notation fills that use opacity premixed like this: translucent over a
 * dark canvas, they would turn into a tinted tone.
 */
export function premixOverWhite(fill: string, opacity: number): string | undefined {
  const colour = parseHexColour(fill);
  const paper = parseHexColour(MIRAGON.weiss);
  if (!colour || !paper) return undefined;
  return hexColour(blendOver(colour, paper, opacity));
}

export interface InteractionPaint {
  fill: string;
  fillOpacity: number;
}

/**
 * How an interaction's fill is drawn: its mode's premixed fill, or its own fill premixed at the
 * mode's opacity, both opaque. An own fill that is not hex cannot be mixed, so it keeps the
 * template's opacity instead of turning solid; the schema rejects such a fill, but a host can import
 * a document without validating it.
 */
export function interactionPaint(
  interaction: Pick<TtInteraction, "mode" | "fill">,
): InteractionPaint {
  const spec = INTERACTION_MODE_SPECS[interaction.mode] ?? INTERACTION_MODE_SPECS.collaboration;
  if (interaction.fill === undefined) {
    return { fill: PREMIXED_INTERACTION_FILLS[spec.mode], fillOpacity: 1 };
  }
  const premixed = premixOverWhite(interaction.fill, spec.opacity);
  return premixed
    ? { fill: premixed, fillOpacity: 1 }
    : { fill: interaction.fill, fillOpacity: spec.opacity };
}
