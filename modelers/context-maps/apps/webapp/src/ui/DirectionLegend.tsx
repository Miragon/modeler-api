/**
 * Three separate legend boxes next to the map: the subdomain types (Kaiser
 * icons), the integration roles (OHS/PL/ACL/CF), and the relationship patterns.
 * This is THE place explaining what the notation means: hovering any item shows
 * the spelled-out explanation instantly (custom CSS tooltip — a native `title`
 * only appears after the OS hover delay).
 */

import {
  ALL_PATTERN_SPECS,
  ALL_SUBDOMAIN_SPECS,
  DOWNSTREAM_ROLE_SPECS,
  MARK_COLORS,
  UPSTREAM_ROLE_SPECS,
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

const ROLES: ReadonlyArray<{ token: string; label: string; description: string }> = [
  { token: "OHS", ...UPSTREAM_ROLE_SPECS.OHS },
  { token: "PL", ...UPSTREAM_ROLE_SPECS.PL },
  { token: "ACL", ...DOWNSTREAM_ROLE_SPECS.ACL },
  { token: "CF", ...DOWNSTREAM_ROLE_SPECS.CF },
];

function LegendItem({ children, explanation }: { children: React.ReactNode; explanation: string }) {
  return (
    <span className="cm-legend-item">
      {children}
      <span className="cm-legend-tip">{explanation}</span>
    </span>
  );
}

export function DirectionLegend() {
  return (
    <div className="cm-legends">
      <div className="cm-legendbox" aria-label="Subdomain types">
        {ALL_SUBDOMAIN_SPECS.map((s) => (
          <LegendItem key={s.type} explanation={s.description}>
            <SubdomainIcon type={s.type} size={18} />
            <span>{s.label}</span>
          </LegendItem>
        ))}
      </div>

      <div className="cm-legendbox" aria-label="Integration roles">
        {ROLES.map((r) => (
          <LegendItem key={r.token} explanation={`${r.label} — ${r.description}`}>
            <span style={{ ...box, background: MARK_COLORS[r.token] }}>{r.token}</span>
            <span>{r.label}</span>
          </LegendItem>
        ))}
      </div>

      <div className="cm-legendbox" aria-label="Relationship patterns">
        {ALL_PATTERN_SPECS.map((p) => (
          <LegendItem key={p.pattern} explanation={p.description}>
            <RelationshipIcon pattern={p.pattern} size={18} />
            <span>
              {p.abbreviation} · {p.label}
            </span>
          </LegendItem>
        ))}
      </div>
    </div>
  );
}
