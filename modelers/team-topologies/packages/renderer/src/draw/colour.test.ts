import { describe, expect, it } from "vitest";
import { ALL_INTERACTION_SPECS, INTERACTION_MODES } from "@miragon/team-topologies-schema-model";
import { PREMIXED_INTERACTION_FILLS } from "../theme/index.js";
import { interactionPaint, premixOverWhite } from "./colour.js";
import { interactionIconSvg } from "./palette-icons.js";

describe("premixOverWhite", () => {
  it("mixes a colour over white at its opacity into one opaque hex colour", () => {
    expect(premixOverWhite("#000000", 0.5)).toBe("#808080");
    expect(premixOverWhite("#335de5", 1)).toBe("#335DE5");
    expect(premixOverWhite("#f00", 0)).toBe("#FFFFFF");
  });

  it("cannot mix a value that is not a hex colour", () => {
    expect(premixOverWhite("rebeccapurple", 0.5)).toBeUndefined();
  });
});

describe("interaction fills", () => {
  it.each(ALL_INTERACTION_SPECS.map((spec) => [spec.mode, spec] as const))(
    "the token module holds the official %s fill premixed over white at its opacity",
    (mode, spec) => {
      expect(PREMIXED_INTERACTION_FILLS[mode]).toBe(premixOverWhite(spec.fill, spec.opacity));
    },
  );

  it.each(INTERACTION_MODES)("draw the %s mode's premixed fill opaque", (mode) => {
    expect(interactionPaint({ mode })).toEqual({
      fill: PREMIXED_INTERACTION_FILLS[mode],
      fillOpacity: 1,
    });
  });

  it("premix an interaction's own fill at its mode's opacity too", () => {
    expect(interactionPaint({ mode: "facilitating", fill: "#1D3A8A" })).toEqual({
      fill: "#8E9DC5",
      fillOpacity: 1,
    });
  });

  it("keep an own fill they cannot mix at the mode's opacity instead of drawing it solid", () => {
    expect(interactionPaint({ mode: "facilitating", fill: "rebeccapurple" })).toEqual({
      fill: "rebeccapurple",
      fillOpacity: 0.5,
    });
  });

  it.each(INTERACTION_MODES)("draw the %s palette preview opaque", (mode) => {
    const markup = interactionIconSvg(mode);
    expect(markup).not.toContain("opacity");
    expect(markup).toContain(`fill="${PREMIXED_INTERACTION_FILLS[mode]}"`);
  });
});
