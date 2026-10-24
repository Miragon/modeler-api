import { afterEach, describe, expect, test } from "vitest";
import { legendGroups, renderLegend } from "@miragon/team-topologies-renderer";
import { ALL_INTERACTION_SPECS, ALL_TEAM_SPECS } from "@miragon/team-topologies-schema-model";

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

/** A legend body as a host's chrome hands it over: an element in the document. */
function legendBody(): HTMLElement {
  const body = document.createElement("div");
  document.body.append(body);
  cleanups.push(() => body.remove());
  return body;
}

function computedColour(value: string): string {
  const probe = document.createElement("span");
  probe.style.color = value;
  document.body.append(probe);
  const colour = getComputedStyle(probe).color;
  probe.remove();
  return colour;
}

describe("legendGroups", () => {
  test("lists every shape of the notation in three groups, in reading order", () => {
    const groups = legendGroups();

    expect(groups.map((group) => [group.label, group.heading])).toEqual([
      ["Team types", "Teams: solid, long-lived"],
      ["Interaction modes", "Interactions: dashed, short-lived"],
      ["Other elements", "Other elements"],
    ]);
    expect(
      groups.flatMap((group) => group.rows.map((row) => `${row.label}: ${row.explanation}`)),
    ).toEqual([
      "Stream-aligned: Delivers one stream of work",
      "Enabling: Coaches teams in new skills",
      "Complicated Subsystem: Owns a specialist subsystem",
      "Platform: Self-service for other teams",
      "Collaboration: Teams work closely for a time",
      "X-as-a-Service: One provides, one consumes",
      "Facilitating: One team helps another learn",
      "Flow of change: Change flows left to right",
      "Annotation: Rationale, questions, plans",
    ]);
  });

  test("draws each team type and interaction mode in its official notation colours", () => {
    const [teams, interactions] = legendGroups();

    ALL_TEAM_SPECS.forEach((spec, index) => {
      const preview = teams!.rows[index]!.preview;
      expect(preview).toContain(`fill="${spec.fill}"`);
      expect(preview).toContain(`stroke="${spec.stroke}"`);
    });
    ALL_INTERACTION_SPECS.forEach((spec, index) => {
      const preview = interactions!.rows[index]!.preview;
      expect(preview).toContain(`fill="${spec.fill}"`);
      expect(preview).toContain(`stroke="${spec.stroke}"`);
      // Interactions are the dashed, short-lived shapes.
      expect(preview).toContain("stroke-dasharray");
    });
  });
});

describe("renderLegend", () => {
  test("renders the groups as named lists with the shell's row, preview and separator classes", () => {
    const body = legendBody();
    renderLegend(body);

    const lists = [...body.querySelectorAll("ul.tt-legend__group")];
    expect(lists.map((list) => list.getAttribute("aria-label"))).toEqual([
      "Team types",
      "Interaction modes",
      "Other elements",
    ]);
    expect([...body.querySelectorAll(".tt-legend__heading")].map((h) => h.textContent)).toEqual(
      legendGroups().map((group) => group.heading),
    );
    expect(body.querySelectorAll("hr.cd-shell-legend-separator")).toHaveLength(2);

    const rows = [...body.querySelectorAll("li.cd-shell-legend-row")];
    expect(rows).toHaveLength(9);
    expect(rows.map((row) => row.textContent)).toEqual(
      legendGroups().flatMap((group) => group.rows.map((r) => `${r.label} ${r.explanation}`)),
    );
    for (const row of rows) {
      const preview = row.querySelector(".cd-shell-legend-preview")!;
      expect(preview.getAttribute("aria-hidden")).toBe("true");
      expect(preview.querySelector("svg")).not.toBeNull();
    }
  });

  test("lays the rows out with the renderer's own styles", () => {
    const body = legendBody();
    renderLegend(body);

    const list = getComputedStyle(body.querySelector(".tt-legend__group")!);
    expect(list.listStyleType).toBe("none");
    expect(list.flexDirection).toBe("column");
    const preview = body.querySelector(".tt-legend__preview svg")!.getBoundingClientRect();
    expect([preview.width, preview.height]).toEqual([24, 24]);
    expect(getComputedStyle(body.querySelector(".tt-legend__text")!).flexDirection).toBe("column");
    expect(getComputedStyle(body.querySelector(".tt-legend__explanation")!).color).toBe(
      computedColour("var(--cd-ui-text-leise)"),
    );
  });

  test("returns the function that removes the rows again, and leaves the body's own content", () => {
    const body = legendBody();
    const own = document.createElement("p");
    body.append(own);

    const remove = renderLegend(body);
    expect(body.children.length).toBeGreaterThan(1);
    remove();

    expect([...body.children]).toEqual([own]);
  });
});
