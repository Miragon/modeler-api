import { expect, test } from "vitest";
import { Modeler } from "@miragon/context-maps-renderer";
import type { CmModeling, CmRelationship } from "@miragon/context-maps-renderer";
import { emptyDocument } from "@miragon/context-maps-schema-model";

interface OverlayEntry {
  position: { left: number; top: number };
  html: HTMLElement;
}

// Semantic findings must show up ON the canvas: a warning triangle anchored
// next to the issue (sided findings at the affected end, e.g. an ACL concern
// at the downstream role chips) whose tooltip (title) carries the message,
// live-updating as the model changes.
test("findings show triangles anchored at the affected end and clear when fixed", () => {
  const container = document.createElement("div");
  container.style.width = "900px";
  container.style.height = "640px";
  document.body.appendChild(container);
  const modeler = new Modeler({ container });
  try {
    const doc = emptyDocument("m");
    doc.contexts = [
      { id: "a", label: "A", position: { x: 100, y: 200 }, size: { width: 200, height: 110 } },
      { id: "b", label: "B", position: { x: 600, y: 200 }, size: { width: 200, height: 110 } },
    ];
    // rule 7: ACL in a customer-supplier relationship is a DOWNSTREAM-sided warning
    doc.relationships = [
      { id: "r", from: "a", to: "b", pattern: "customer-supplier", downstreamRoles: ["ACL"] },
    ];
    modeler.importDocument(doc);

    const overlays = modeler.get<{ get(filter: { type: string }): OverlayEntry[] }>("overlays");
    const markers = () => overlays.get({ type: "cm-validation" });

    const tooltipText = (m: OverlayEntry) =>
      m.html.querySelector(".cm-validation-tooltip")?.textContent ?? "";

    // one marker, anchored at the ACL chip near the downstream end
    expect(markers()).toHaveLength(1);
    const [aclMarker] = markers();
    expect(tooltipText(aclMarker)).toContain("may be unnecessary");
    // line runs 300→600 in x (bbox-relative 0..300): downstream anchor sits in the last third
    expect(aclMarker.position.left).toBeGreaterThan(200);

    // an upstream-sided finding (OHS is invalid in customer-supplier) adds a
    // SECOND marker at the upstream end's OHS chip
    const registry = modeler.get<{ get(id: string): unknown }>("elementRegistry");
    const cmModeling = modeler.get<CmModeling>("cmModeling");
    const rel = registry.get("r") as CmRelationship;
    cmModeling.updateProperties(rel, { upstreamRoles: ["OHS"] });
    expect(markers()).toHaveLength(2);
    const upstreamMarker = markers().find((m) => tooltipText(m).includes("Open Host Service"));
    expect(upstreamMarker).toBeDefined();
    expect(upstreamMarker!.position.left).toBeLessThan(100); // first third = upstream end
    expect(upstreamMarker!.html.innerHTML).toContain("#dc2626"); // error → red

    // fixing everything removes all markers
    cmModeling.updateProperties(rel, { upstreamRoles: undefined, downstreamRoles: undefined });
    expect(markers()).toHaveLength(0);
  } finally {
    modeler.destroy();
    container.remove();
  }
});
