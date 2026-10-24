import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Viewer } from "../../src/index.js";
import { textColorOn } from "../../src/draw/contrast.js";
import { MIRAGON } from "../../src/theme/palette.js";
import "../../src/assets/event-storming.css";

// The DSL takes CSS colour names as well as hex (`(color navy)`), and a stored board any CSS
// colour. Only a browser resolves those, so the black-or-white text rule is checked here too.
describe("sticky text on a fill the user picks, with CSS colours (guide §10.6)", () => {
  it.each([
    ["navy", MIRAGON.weiss],
    ["darkgreen", MIRAGON.weiss],
    ["rgb(29, 29, 29)", MIRAGON.weiss],
    ["hsl(0 0% 10%)", MIRAGON.weiss],
    ["yellow", MIRAGON.schwarz],
    ["LightBlue", MIRAGON.schwarz],
    ["transparent", MIRAGON.schwarz],
    ["rgba(0, 0, 0, 0.2)", MIRAGON.schwarz],
    ["no-such-colour", MIRAGON.schwarz],
  ])("writes on %s in %s", (fill, expected) => {
    expect(textColorOn(fill)).toBe(expected);
  });

  describe("on the canvas and in the SVG export", () => {
    let container: HTMLElement;
    let viewer: Viewer;

    beforeEach(() => {
      container = document.createElement("div");
      container.style.width = "800px";
      container.style.height = "600px";
      document.body.appendChild(container);
      viewer = new Viewer({ container });
    });

    afterEach(() => {
      viewer.destroy();
      container.remove();
    });

    it("draws label and caption white on a navy sticky and black on a yellow one", async () => {
      await viewer.importDSL(
        "title Colours\nevent Dark [200, 200] (color navy)\nevent Light [400, 200] (color yellow)",
      );
      const fillsOf = (root: ParentNode, label: string) => {
        const sticky = [...root.querySelectorAll("g.djs-visual")].find((visual) =>
          [...visual.querySelectorAll("text")].some((text) => text.textContent === label),
        );
        return new Set(
          [...sticky!.querySelectorAll<SVGTextElement>("text")].map((text) => text.style.fill),
        );
      };
      expect(fillsOf(container, "Dark")).toEqual(new Set(["rgb(255, 255, 255)"]));
      expect(fillsOf(container, "Light")).toEqual(new Set(["rgb(29, 29, 29)"]));

      const { svg } = await viewer.saveSVG();
      const exported = new DOMParser().parseFromString(svg, "image/svg+xml");
      expect(fillsOf(exported, "Dark")).toEqual(new Set(["rgb(255, 255, 255)"]));
      expect(fillsOf(exported, "Light")).toEqual(new Set(["rgb(29, 29, 29)"]));
    });
  });
});
