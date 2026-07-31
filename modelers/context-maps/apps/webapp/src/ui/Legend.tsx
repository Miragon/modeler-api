/**
 * Consolidated, collapsible legend (single box, bottom-left) mapping the whole
 * notation: subdomain types, integration roles (OHS/PL/ACL/CF) and the
 * relationship patterns. This is THE place explaining what the notation means:
 * hovering any row shows the spelled-out explanation instantly (custom CSS
 * tooltip — a native `title` only appears after the OS hover delay).
 */

import {
  ALL_PATTERN_SPECS,
  ALL_SUBDOMAIN_SPECS,
  DOWNSTREAM_ROLE_SPECS,
  MARK_COLORS,
  UPSTREAM_ROLE_SPECS,
} from "@miragon/context-maps-schema-model";
import { RelationshipIcon, SubdomainIcon } from "./ShapeIcon";
import { useUiStore } from "./uiStore";

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

function LegendRow({ children, explanation }: { children: React.ReactNode; explanation: string }) {
  return (
    <div className="tt-legend__row cm-legend-item">
      {children}
      <span className="cm-legend-tip">{explanation}</span>
    </div>
  );
}

export function Legend() {
  const open = useUiStore((s) => s.legendOpen);
  const toggle = useUiStore((s) => s.toggleLegend);

  // Collapsed: the legend never disappears entirely — it shrinks to a button
  // in the same corner that expands it again.
  if (!open) {
    return (
      <button
        type="button"
        className="tt-iconbtn tt-legend-toggle"
        onClick={toggle}
        aria-expanded={false}
        aria-label="Show legend"
      >
        <span className="tt-iconbtn__glyph" aria-hidden>
          ▤
        </span>
        <span>Legend</span>
      </button>
    );
  }

  return (
    <div className="tt-legend" aria-label="Legend">
      <div className="tt-legend__head">
        <strong>Legend</strong>
        <button
          type="button"
          className="tt-legend__close"
          onClick={toggle}
          aria-expanded
          aria-label="Collapse legend"
        >
          –
        </button>
      </div>
      <div className="tt-legend__group" aria-label="Subdomain types">
        {ALL_SUBDOMAIN_SPECS.map((s) => (
          <LegendRow key={s.type} explanation={s.description}>
            <SubdomainIcon type={s.type} size={18} />
            <span>{s.label}</span>
          </LegendRow>
        ))}
      </div>
      <div className="tt-legend__divider" />
      <div className="tt-legend__group" aria-label="Integration roles">
        {ROLES.map((r) => (
          <LegendRow key={r.token} explanation={`${r.label} — ${r.description}`}>
            <span style={{ ...box, background: MARK_COLORS[r.token] }}>{r.token}</span>
            <span>{r.label}</span>
          </LegendRow>
        ))}
      </div>
      <div className="tt-legend__divider" />
      <div className="tt-legend__group" aria-label="Relationship patterns">
        {ALL_PATTERN_SPECS.map((p) => (
          <LegendRow key={p.pattern} explanation={p.description}>
            <RelationshipIcon pattern={p.pattern} size={18} />
            <span>
              {p.abbreviation} · {p.label}
            </span>
          </LegendRow>
        ))}
      </div>
    </div>
  );
}
