/**
 * Floating inspector (top-right of the canvas). Appears only while exactly one
 * element is selected — a bounded context or a relationship — editing it through
 * the modeler's modeling services (every change is undoable). For relationships
 * it also surfaces the strategic-DDD semantic-rule findings live.
 */

import {
  DOWNSTREAM_ROLES,
  RELATIONSHIP_PATTERNS,
  RELATIONSHIP_PATTERN_SPECS,
  SUBDOMAIN_TYPES,
  SUBDOMAIN_TYPE_SPECS,
  UPSTREAM_ROLES,
  isSymmetricPattern,
  validateDocument,
  type DownstreamRole,
  type RelationshipPattern,
  type SubdomainType,
  type UpstreamRole,
} from "@miragon/context-maps-schema-model";
import type { CmContext, CmModeling, CmRelationship } from "@miragon/context-maps-renderer";
import { isCmContext, isCmRelationship } from "@miragon/context-maps-renderer";
import { useModeler } from "@/state/modelerContext";
import { CommitInput } from "./CommitInput";
import { RelationshipIcon, SubdomainIcon } from "./ShapeIcon";

interface Modeling {
  removeElements(elements: unknown[]): void;
}

function useServices() {
  const { modeler } = useModeler();
  return {
    cmModeling: modeler.get<CmModeling>("cmModeling"),
    modeling: modeler.get<Modeling>("modeling"),
  };
}

function ContextInspector({ context }: { context: CmContext }) {
  const { cmModeling, modeling } = useServices();
  const type = context.subdomainType;
  const spec = type ? SUBDOMAIN_TYPE_SPECS[type] : undefined;

  return (
    <div className="tt-inspector__content" key={context.id}>
      <header className="tt-inspector__header">
        {type && <SubdomainIcon type={type} />}
        <span>{spec?.label ?? "Bounded Context"}</span>
      </header>

      <label className="tt-field">
        <span className="tt-field__label">Subdomain type</span>
        <select
          className="tt-field__control"
          value={type ?? ""}
          onChange={(e) =>
            cmModeling.setSubdomainType(context, (e.target.value || undefined) as SubdomainType)
          }
        >
          <option value="">Unclassified</option>
          {SUBDOMAIN_TYPES.map((t) => (
            <option key={t} value={t}>
              {SUBDOMAIN_TYPE_SPECS[t].label}
            </option>
          ))}
        </select>
      </label>

      <label className="tt-field">
        <span className="tt-field__label">Name</span>
        <CommitInput
          value={context.cmLabel ?? ""}
          ariaLabel="Context name"
          onCommit={(label) => {
            const next = label.trim();
            if (next) cmModeling.updateLabel(context, next);
          }}
        />
      </label>

      <label className="tt-field">
        <span className="tt-field__label">Owning team</span>
        <CommitInput
          value={context.team ?? ""}
          placeholder="One team per context"
          ariaLabel="Owning team"
          onCommit={(team) => cmModeling.setTeam(context, team.trim() || undefined)}
        />
      </label>

      <label className="tt-field">
        <span className="tt-field__label">Description</span>
        <CommitInput
          value={context.description ?? ""}
          multiline
          placeholder="Purpose, ubiquitous language, notes…"
          ariaLabel="Context description"
          onCommit={(description) => cmModeling.setDescription(context, description || undefined)}
        />
      </label>

      <button
        type="button"
        className="tt-btn tt-btn--danger"
        onClick={() => modeling.removeElements([context])}
      >
        Delete context
      </button>
    </div>
  );
}

/** Segmented multi-select toggle for combinable roles (e.g. OHS + PL). */
function RoleToggle<T extends string>({
  label,
  all,
  selected,
  onChange,
  disabledReason,
}: {
  label: string;
  all: readonly T[];
  selected: T[];
  onChange: (next: T[]) => void;
  /** Non-null → the option is disabled and the string explains why (tooltip). */
  disabledReason?: (role: T) => string | null;
}) {
  const toggle = (role: T) => {
    const has = selected.includes(role);
    onChange(has ? selected.filter((r) => r !== role) : [...selected, role]);
  };
  return (
    <div className="tt-field">
      <span className="tt-field__label">{label}</span>
      <div className="tt-switch" role="group">
        {all.map((role) => {
          const reason = disabledReason?.(role) ?? null;
          return (
            <button
              key={role}
              type="button"
              disabled={!!reason}
              title={reason ?? undefined}
              className={
                "tt-switch__opt" +
                (selected.includes(role) ? " is-active" : "") +
                (reason ? " is-disabled" : "")
              }
              aria-pressed={selected.includes(role)}
              onClick={() => !reason && toggle(role)}
            >
              {role}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Single-select segmented switch for mutually-exclusive roles (e.g. ACL vs CF). */
function RoleSwitch<T extends string>({
  label,
  all,
  value,
  onChange,
  disabledReason,
}: {
  label: string;
  all: readonly T[];
  value: T | null;
  onChange: (next: T | null) => void;
  /** Non-null → the option is disabled and the string explains why (tooltip). */
  disabledReason?: (role: T) => string | null;
}) {
  const options: Array<T | null> = [null, ...all];
  return (
    <div className="tt-field">
      <span className="tt-field__label">{label}</span>
      <div className="tt-switch" role="group">
        {options.map((opt) => {
          const reason = opt ? (disabledReason?.(opt) ?? null) : null;
          return (
            <button
              key={opt ?? "none"}
              type="button"
              disabled={!!reason}
              title={reason ?? undefined}
              className={
                "tt-switch__opt" +
                (value === opt ? " is-active" : "") +
                (reason ? " is-disabled" : "")
              }
              aria-pressed={value === opt}
              onClick={() => !reason && onChange(opt)}
            >
              {opt ?? "None"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RelationshipInspector({ relationship }: { relationship: CmRelationship }) {
  const { modeler } = useModeler();
  const { cmModeling, modeling } = useServices();
  const spec = RELATIONSHIP_PATTERN_SPECS[relationship.pattern];
  const symmetric = isSymmetricPattern(relationship.pattern);
  const isCustomerSupplier = relationship.pattern === "customer-supplier";

  // Live semantic findings for this relationship (from the whole-document rules).
  const report = validateDocument(modeler.exportDocument());
  const findings = [
    ...report.errors.map((f) => ({ ...f, kind: "error" as const })),
    ...report.warnings.map((f) => ({ ...f, kind: "warning" as const })),
  ].filter((f) => f.relationshipId === relationship.id);

  return (
    <div className="tt-inspector__content" key={relationship.id}>
      <header className="tt-inspector__header">
        <RelationshipIcon pattern={relationship.pattern} />
        <span>{spec.label}</span>
      </header>

      <div className="tt-field">
        <span className="tt-field__label">Pattern</span>
        <div className="tt-pattern-row">
          <select
            className="tt-field__control"
            value={relationship.pattern}
            onChange={(e) =>
              cmModeling.setPattern(relationship, e.target.value as RelationshipPattern)
            }
          >
            {RELATIONSHIP_PATTERNS.map((p) => (
              <option key={p} value={p}>
                {RELATIONSHIP_PATTERN_SPECS[p].label}
              </option>
            ))}
          </select>
          {!symmetric && (
            <button
              type="button"
              className="tt-swapbtn"
              title="Swap ends — reverse upstream/downstream"
              aria-label="Swap ends"
              onClick={() => cmModeling.swapEnds(relationship)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M7 4 3 8l4 4" />
                <path d="M3 8h13" />
                <path d="m17 20 4-4-4-4" />
                <path d="M21 16H8" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <p className="tt-inspector__meta">{spec.description}</p>

      {!symmetric && (
        <>
          <RoleToggle
            label="Upstream roles (from) — OHS and/or PL"
            all={UPSTREAM_ROLES}
            selected={relationship.upstreamRoles ?? []}
            onChange={(next: UpstreamRole[]) => cmModeling.setUpstreamRoles(relationship, next)}
            disabledReason={(role) =>
              isCustomerSupplier && role === "OHS"
                ? "Open Host Service is one-size-fits-all and not applicable in a customer-supplier relationship."
                : null
            }
          />
          <RoleSwitch
            label="Downstream role (to) — ACL or CF, not both"
            all={DOWNSTREAM_ROLES}
            value={relationship.downstreamRoles?.[0] ?? null}
            onChange={(next: DownstreamRole | null) =>
              cmModeling.setDownstreamRoles(relationship, next ? [next] : [])
            }
            disabledReason={(role) =>
              isCustomerSupplier && role === "CF"
                ? "Conformist is not applicable in a customer-supplier relationship — a customer can negotiate."
                : null
            }
          />
        </>
      )}

      <label className="tt-field">
        <span className="tt-field__label">Label</span>
        <CommitInput
          value={relationship.cmLabel ?? ""}
          placeholder="e.g. what is exchanged"
          ariaLabel="Relationship label"
          onCommit={(label) => cmModeling.updateLabel(relationship, label.trim())}
        />
      </label>

      <label className="tt-field">
        <span className="tt-field__label">Implementation technology</span>
        <CommitInput
          value={relationship.implementationTechnology ?? ""}
          placeholder="e.g. RESTful HTTP"
          ariaLabel="Implementation technology"
          onCommit={(tech) =>
            cmModeling.setImplementationTechnology(relationship, tech.trim() || undefined)
          }
        />
      </label>

      {findings.length > 0 && (
        <ul className="tt-findings">
          {findings.map((f, i) => (
            <li key={i} className={`tt-finding tt-finding--${f.kind}`}>
              {f.kind === "error" ? "⛔" : "⚠️"} {f.message}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="tt-btn tt-btn--danger"
        onClick={() => modeling.removeElements([relationship])}
      >
        Delete relationship
      </button>
    </div>
  );
}

export function Inspector() {
  // `revision` is read so the inspector re-renders when the selected element mutates.
  const { selected, revision } = useModeler();
  void revision;

  let body: React.ReactNode;
  if (isCmContext(selected)) {
    body = <ContextInspector context={selected} />;
  } else if (isCmRelationship(selected)) {
    body = <RelationshipInspector relationship={selected} />;
  } else {
    return null;
  }

  return (
    <aside className="tt-inspector" aria-label="Inspector">
      {body}
    </aside>
  );
}
