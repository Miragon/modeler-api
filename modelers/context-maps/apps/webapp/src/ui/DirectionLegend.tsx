/**
 * Three separate legend boxes next to the map: the subdomain types (Kaiser
 * icons), the directions (U/D), and the integration roles (OHS/PL/ACL/CF). Each
 * marker is its own coloured box; hovering shows the spelled-out meaning.
 */

import {
  ALL_PATTERN_SPECS,
  ALL_SUBDOMAIN_SPECS,
  MARK_COLORS,
} from "@miragon/context-maps-schema-model";
import { RelationshipIcon, SubdomainIcon } from "./ShapeIcon";

const box: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 22,
  height: 20,
  padding: "0 6px",
  borderRadius: 4,
  color: "#fff",
  fontSize: 12,
  fontWeight: 700,
  border: "1px solid rgba(0,0,0,0.2)",
};

const ROLES: ReadonlyArray<{ token: string; label: string }> = [
  { token: "OHS", label: "Open Host Service" },
  { token: "PL", label: "Published Language" },
  { token: "ACL", label: "Anticorruption Layer" },
  { token: "CF", label: "Conformist" },
];

function MarkItem({ token, label }: { token: string; label: string }) {
  return (
    <span className="cm-legend-item" title={`${token} — ${label}`}>
      <span style={{ ...box, background: MARK_COLORS[token] }}>{token}</span>
      <span>{label}</span>
    </span>
  );
}

export function DirectionLegend() {
  return (
    <div className="cm-legends">
      <div className="cm-legendbox" aria-label="Subdomain types">
        {ALL_SUBDOMAIN_SPECS.map((s) => (
          <span key={s.type} className="cm-legend-item" title={`${s.label} — ${s.description}`}>
            <SubdomainIcon type={s.type} size={18} />
            <span>{s.label}</span>
          </span>
        ))}
      </div>

      <div className="cm-legendbox" aria-label="Integration roles">
        {ROLES.map((r) => (
          <MarkItem key={r.token} token={r.token} label={r.label} />
        ))}
      </div>

      <div className="cm-legendbox" aria-label="Relationship patterns">
        {ALL_PATTERN_SPECS.map((p) => (
          <span key={p.pattern} className="cm-legend-item" title={`${p.label} — ${p.description}`}>
            <RelationshipIcon pattern={p.pattern} size={18} />
            <span>
              {p.abbreviation} · {p.label}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
