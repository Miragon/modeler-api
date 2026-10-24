import { describe, expect, it } from "vitest";
import { ICON_EDIT, iconMarkup } from "../src/draw/icons.js";
import { LUCIDE, chromeIcon, type LucideIconName } from "../src/draw/lucide.js";

describe("icon markup", () => {
  it("renders a known path unchanged", () => {
    expect(iconMarkup(ICON_EDIT, 16)).toContain(`<path d="${ICON_EDIT}"/>`);
  });

  it("escapes a path that would break out of its attribute", () => {
    const hostile = '"/><img src=x onerror=alert(1)><path d="';
    const markup = iconMarkup(hostile);
    expect(markup).not.toContain("<img");
    expect(markup).toContain("&quot;/&gt;&lt;img");
  });
});

describe("chrome icons", () => {
  it("draws every Lucide icon at 16px with stroke 2.5 in currentColor and no fill", () => {
    for (const name of Object.keys(LUCIDE) as LucideIconName[]) {
      const markup = chromeIcon(name);
      expect(markup, name).toMatch(/^<svg [^>]*width="16" height="16" viewBox="0 0 24 24"/);
      expect(markup, name).toContain('fill="none" stroke="currentColor" stroke-width="2.5"');
      expect(markup, name).toContain('stroke-linecap="round" stroke-linejoin="round"');
      expect(markup, name).toContain(LUCIDE[name]);
    }
  });

  it("keeps the derived icon on the Lucide grid: strokes only, centre lines within 2 to 22", () => {
    const geometry = LUCIDE["chevrons-right-x"];
    expect(geometry).not.toMatch(/fill=|<mask|#/);
    // Every path is a relative `m x y dx dy …` polyline.
    const points = [...geometry.matchAll(/d="m([^"]+)"/g)].flatMap(([, data]) => {
      const [x, y, ...deltas] = data!.match(/-?\d*\.?\d+/g)!.map(Number);
      const visited = [{ x: x!, y: y! }];
      for (let index = 0; index < deltas.length; index += 2) {
        const previous = visited.at(-1)!;
        visited.push({ x: previous.x + deltas[index]!, y: previous.y + deltas[index + 1]! });
      }
      return visited;
    });
    expect(points.length).toBeGreaterThan(8);
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(2);
      expect(point.x).toBeLessThanOrEqual(22);
      expect(point.y).toBeGreaterThanOrEqual(2);
      expect(point.y).toBeLessThanOrEqual(22);
    }
  });
});
