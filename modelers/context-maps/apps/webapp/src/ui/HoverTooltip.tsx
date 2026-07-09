/**
 * A fast custom hover tooltip (native SVG <title> has a ~1.5s browser delay).
 * Subscribes to diagram-js hover events and shows the spelled-out meaning of the
 * hovered element immediately: the subdomain description for a context, or the
 * pattern + roles for a relationship.
 */

import { useEffect, useState } from "react";
import { isCmContext, isCmRelationship } from "@miragon/context-maps-renderer";
import type { CmContext, CmRelationship } from "@miragon/context-maps-renderer";
import {
  DOWNSTREAM_ROLE_SPECS,
  RELATIONSHIP_PATTERN_SPECS,
  SUBDOMAIN_TYPE_SPECS,
  UPSTREAM_ROLE_SPECS,
  isSymmetricPattern,
} from "@miragon/context-maps-schema-model";
import { useModeler } from "@/state/modelerContext";

interface Tip {
  title: string;
  body: string;
}

function tipFor(element: unknown): Tip | null {
  if (isCmContext(element)) {
    const c = element as CmContext;
    const parts: string[] = [];
    if (c.subdomainType) parts.push(SUBDOMAIN_TYPE_SPECS[c.subdomainType].description);
    if (c.description) parts.push(c.description);
    if (c.team) parts.push(`Team: ${c.team}`);
    if (parts.length === 0) return null;
    const title = c.subdomainType
      ? `${SUBDOMAIN_TYPE_SPECS[c.subdomainType].label}${c.cmLabel ? ` · ${c.cmLabel}` : ""}`
      : (c.cmLabel ?? "Bounded Context");
    return { title, body: parts.join(" · ") };
  }
  if (isCmRelationship(element)) {
    const r = element as CmRelationship;
    const s = RELATIONSHIP_PATTERN_SPECS[r.pattern];
    if (isSymmetricPattern(r.pattern)) return { title: s.label, body: s.description };
    const up = (r.upstreamRoles ?? []).map((x) => UPSTREAM_ROLE_SPECS[x].label);
    const down = (r.downstreamRoles ?? []).map((x) => DOWNSTREAM_ROLE_SPECS[x].label);
    const body =
      s.description +
      (up.length ? ` · Upstream provides ${up.join(", ")}` : "") +
      (down.length ? ` · Downstream consumes ${down.join(", ")}` : "");
    return { title: s.label, body };
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
      <span>{state.tip.body}</span>
    </div>
  );
}
