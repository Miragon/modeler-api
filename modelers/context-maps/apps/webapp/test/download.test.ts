import { describe, expect, it } from "vitest";
import { mapFileName, slugify } from "../src/io/download";

describe("download names", () => {
  it("name a download after the map's title", () => {
    expect(mapFileName("Conference Planner", ".cm.json")).toBe("conference-planner.cm.json");
    expect(mapFileName("Shop — orders & billing", ".png")).toBe("shop-orders-billing.png");
  });

  it("fall back to context-map for a title without letters or digits", () => {
    expect(slugify("")).toBe("context-map");
    expect(mapFileName("—", ".cml")).toBe("context-map.cml");
  });
});
