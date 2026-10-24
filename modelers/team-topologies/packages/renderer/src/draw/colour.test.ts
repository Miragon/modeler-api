import { describe, expect, it } from "vitest";
import { ALL_INTERACTION_SPECS, INTERACTION_MODES } from "@miragon/team-topologies-schema-model";
import { interactionFill, premixOverWhite } from "./colour.js";
import { interactionIconSvg } from "./palette-icons.js";

// The official interaction fills at the templates' 50 %, mixed over white (guide §10.6).
const PREMIXED_INTERACTION_FILLS = {
  collaboration: "#E3DFEF",
  "x-as-a-service": "#DADADA",
  facilitating: "#E4EFDF",
};

describe("premixOverWhite", () => {
  it("mixes a colour over white at its opacity into one opaque hex colour", () => {
    expect(premixOverWhite("#000000", 0.5)).toBe("#808080");
    expect(premixOverWhite("#335de5", 1)).toBe("#335DE5");
    expect(premixOverWhite("#f00", 0)).toBe("#FFFFFF");
  });

  it("leaves a value it cannot read as it is", () => {
    expect(premixOverWhite("rebeccapurple", 0.5)).toBe("rebeccapurple");
  });
});

describe("interaction fills", () => {
  it("are the official fills premixed over white at each mode's opacity", () => {
    expect(
      Object.fromEntries(ALL_INTERACTION_SPECS.map((spec) => [spec.mode, interactionFill(spec)])),
    ).toEqual(PREMIXED_INTERACTION_FILLS);
  });

  it("premix an interaction's own fill at its mode's opacity too", () => {
    expect(interactionFill({ mode: "facilitating", fill: "#1D3A8A" })).toBe("#8E9DC5");
  });

  it.each(INTERACTION_MODES)("draw the %s palette preview opaque", (mode) => {
    const markup = interactionIconSvg(mode);
    expect(markup).not.toContain("opacity");
    expect(markup).toContain(`fill="${PREMIXED_INTERACTION_FILLS[mode]}"`);
  });
});
