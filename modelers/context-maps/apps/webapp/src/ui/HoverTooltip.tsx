/**
 * A fast custom hover tooltip (native SVG <title> has a ~1.5s browser delay).
 * Subscribes to diagram-js hover events and immediately shows the hovered
 * element's OWN data — its description (plus team / technology). What the
 * notation itself means lives exclusively in the legend at the bottom.
 */

import { useEffect, useState } from "react";
import { isCmContext, isCmRelationship } from "@miragon/context-maps-renderer";
import type { CmContext, CmRelationship } from "@miragon/context-maps-renderer";
import { RELATIONSHIP_PATTERN_SPECS } from "@miragon/context-maps-schema-model";
import { useModeler } from "@/state/modelerContext";

interface Tip {
  title: string;
  body: string;
}

function tipFor(element: unknown): Tip | null {
  if (isCmContext(element)) {
    const c = element as CmContext;
    const parts: string[] = [];
    if (c.description) parts.push(c.description);
    if (c.team) parts.push(`Team: ${c.team}`);
    if (parts.length === 0) return null;
    return { title: c.cmLabel ?? "Bounded Context", body: parts.join(" · ") };
  }
  if (isCmRelationship(element)) {
    const r = element as CmRelationship;
    const spec = RELATIONSHIP_PATTERN_SPECS[r.pattern];
    const parts: string[] = [];
    if (r.description) parts.push(r.description);
    if (r.implementationTechnology) parts.push(r.implementationTechnology);
    // Always identify the line (pattern + label); the description when present.
    const title = r.cmLabel ? `${spec.label} · ${r.cmLabel}` : spec.label;
    return { title, body: parts.join(" · ") };
  }
  return null;
}

export function HoverTooltip() {
  const { modeler } = useModeler();
  const [state, setState] = useState<{ tip: Tip; x: number; y: number } | null>(null);

  useEffect(() => {
    const onHover = (raw: unknown) => {
      const e = raw as { element?: unknown; originalEvent?: MouseEvent };
      const tip = tipFor(e.element);
      if (!tip) {
        setState(null);
        return;
      }
      setState({ tip, x: e.originalEvent?.clientX ?? 0, y: e.originalEvent?.clientY ?? 0 });
    };
    const onOut = () => setState(null);
    modeler.on("element.hover", onHover);
    modeler.on("element.out", onOut);
    return () => {
      modeler.off("element.hover", onHover);
      modeler.off("element.out", onOut);
    };
  }, [modeler]);

  useEffect(() => {
    if (!state) return;
    const onMove = (e: MouseEvent) =>
      setState((s) => (s ? { ...s, x: e.clientX, y: e.clientY } : s));
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [state]);

  if (!state) return null;
  // Keep the tooltip within the viewport horizontally.
  const left = Math.min(state.x + 14, window.innerWidth - 300);
  return (
    <div className="cm-tooltip" style={{ left, top: state.y + 18 }}>
      <strong>{state.tip.title}</strong>
      {state.tip.body && <span>{state.tip.body}</span>}
    </div>
  );
}
