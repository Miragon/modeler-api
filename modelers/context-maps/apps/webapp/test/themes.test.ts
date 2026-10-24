import { expect, it } from "vitest";
import { THEMES } from "../src/themes";

it("draws the map light only until the joint dark-mode release (guide §13.3)", () => {
  expect(THEMES).toEqual(["light"]);
});
