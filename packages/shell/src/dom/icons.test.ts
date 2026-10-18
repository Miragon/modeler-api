import { describe, expect, it } from "vitest";

import {
  ICONS,
  PALETTE_TOOL_ICON,
  iconElement,
  iconMarkup,
  type IconNode,
  type ShellIconName,
} from "./icons.js";

const COMMON_SET: readonly ShellIconName[] = [
  "menu",
  "minus",
  "plus",
  "maximize",
  "check",
  "x",
  "file-plus",
  "folder-open",
  "import",
  "file-image",
  "file-code-corner",
  "keyboard",
  "share-2",
  "circle-x",
  "triangle-alert",
  "square-dashed-mouse-pointer",
  "hand",
  "spline",
  "unfold-horizontal",
  "workflow",
];

function parse(markup: string): SVGSVGElement {
  const template = document.createElement("template");
  template.innerHTML = markup;
  const svg = template.content.firstElementChild;
  if (!svg) throw new Error("no element");
  return svg as SVGSVGElement;
}

describe("ICONS", () => {
  it("holds the common set of guide §5.14, every icon with geometry", () => {
    expect(Object.keys(ICONS).sort()).toEqual([...COMMON_SET].sort());
    for (const name of COMMON_SET) expect(ICONS[name].length, name).toBeGreaterThan(0);
  });

  it("keeps lucide-static 1.59.0 geometry unchanged", () => {
    expect(ICONS.menu).toEqual([
      ["path", { d: "M4 5h16" }],
      ["path", { d: "M4 12h16" }],
      ["path", { d: "M4 19h16" }],
    ]);
    expect(ICONS.check).toEqual([["path", { d: "M20 6 9 17l-5-5" }]]);
    expect(ICONS["share-2"][3]).toEqual(["line", { x1: "8.59", x2: "15.42", y1: "13.51", y2: "17.49" }]);
    expect(ICONS.workflow[0]).toEqual(["rect", { width: "8", height: "8", x: "3", y: "3", rx: "2" }]);
  });
});

describe("iconMarkup", () => {
  it("renders decorative 16px chrome icons with stroke 2.5 and round caps", () => {
    const svg = parse(iconMarkup("plus"));
    expect(svg.getAttribute("width")).toBe("16");
    expect(svg.getAttribute("height")).toBe("16");
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("fill")).toBe("none");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("stroke-width")).toBe("2.5");
    expect(svg.getAttribute("stroke-linecap")).toBe("round");
    expect(svg.getAttribute("stroke-linejoin")).toBe("round");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("focusable")).toBe("false");
    expect([...svg.children].map((child) => child.getAttribute("d"))).toEqual(["M5 12h14", "M12 5v14"]);
  });

  it("takes size, stroke width and class, and the palette tool preset", () => {
    const svg = parse(iconMarkup("hand", { ...PALETTE_TOOL_ICON, className: "tool" }));
    expect(svg.getAttribute("width")).toBe("20");
    expect(svg.getAttribute("stroke-width")).toBe("2");
    expect(svg.getAttribute("class")).toBe("tool");
    expect(parse(iconMarkup("hand", { size: -3, strokeWidth: Number.NaN })).getAttribute("width")).toBe("16");
  });

  it("drops every element and attribute that is not Lucide geometry", () => {
    const hostile: IconNode = [
      ["script", { src: "https://example.com/x.js" }],
      ["path", { d: "M1 1h2", onload: "alert(1)", style: "fill:red" }],
      ["image", { href: "https://example.com/x.png" }],
      ["circle", { cx: "1", cy: "2", r: "3", "xlink:href": "#x" }],
      ["foreignObject", { width: "10" }],
    ];
    const markup = iconMarkup(hostile, { className: '"><script>alert(1)</script>' });
    expect(markup).not.toMatch(/<script|onload|style=|image|href|foreignObject/);
    const svg = parse(markup);
    expect([...svg.children].map((child) => child.localName)).toEqual(["path", "circle"]);
    expect(svg.querySelector("path")?.getAttributeNames()).toEqual(["d"]);
    expect(svg.getAttribute("class")).toBe('"><script>alert(1)</script>');
  });

  it("escapes attribute values", () => {
    expect(iconMarkup([["path", { d: 'M0 0"/><script>' }]])).toContain('d="M0 0&quot;/&gt;&lt;script&gt;"');
  });
});

describe("iconElement", () => {
  it("builds the same SVG as an element", () => {
    const element = iconElement("circle-x", { className: "status" });
    const fromMarkup = parse(iconMarkup("circle-x", { className: "status" }));
    expect(element.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(element.getAttributeNames().sort()).toEqual(
      fromMarkup
        .getAttributeNames()
        .filter((name) => name !== "xmlns")
        .sort(),
    );
    expect([...element.children].map((child) => child.outerHTML)).toEqual(
      [...fromMarkup.children].map((child) => child.outerHTML),
    );
  });
});
