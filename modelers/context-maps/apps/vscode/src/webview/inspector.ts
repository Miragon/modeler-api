/**
 * Floating inspector (top-right of the canvas). Appears only while exactly one
 * element is selected — a bounded context or a relationship — editing it through
 * the modeler's modeling services (every change is undoable). For relationships
 * it also surfaces the strategic-DDD semantic-rule findings live. Vanilla-DOM
 * twin of the webapp's `Inspector.tsx`.
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
import { isCmContext, isCmRelationship } from "@miragon/context-maps-renderer";
import type {
  CmContext,
  CmModeling,
  CmRelationship,
  Modeler,
} from "@miragon/context-maps-renderer";
import { relationshipIconSvg, subdomainIconSvg } from "./shapeIcons.js";

interface Modeling {
  removeElements(elements: unknown[]): void;
}
interface Selection {
  get(): unknown[];
}

// ---------------------------------------------------------------------------
// Small DOM builders
// ---------------------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

/** Text input / textarea that commits on blur or Enter (once per edit, not per keystroke). */
function commitInput(opts: {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  ariaLabel?: string;
}): HTMLInputElement | HTMLTextAreaElement {
  const input = opts.multiline
    ? el("textarea", "tt-field__control")
    : el("input", "tt-field__control");
  input.value = opts.value;
  if (opts.placeholder) input.placeholder = opts.placeholder;
  if (opts.ariaLabel) input.setAttribute("aria-label", opts.ariaLabel);
  if (input instanceof HTMLTextAreaElement) {
    input.rows = 3;
  } else {
    input.type = "text";
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        input.blur();
      }
    });
  }
  input.addEventListener("blur", () => {
    if (input.value !== opts.value) opts.onCommit(input.value);
  });
  return input;
}

/** Labelled field wrapper (`<label>` so clicking the label focuses the control). */
function field(label: string, control: HTMLElement): HTMLLabelElement {
  const wrap = el("label", "tt-field");
  const span = el("span", "tt-field__label");
  span.textContent = label;
  wrap.append(span, control);
  return wrap;
}

function dropdown(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string,
  onChange: (value: string) => void,
): HTMLSelectElement {
  const select = el("select", "tt-field__control");
  for (const option of options) {
    const opt = el("option");
    opt.value = option.value;
    opt.textContent = option.label;
    select.append(opt);
  }
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  return select;
}

function dangerButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = el("button", "tt-btn tt-btn--danger");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function header(iconSvg: string | null, label: string): HTMLElement {
  const head = el("header", "tt-inspector__header");
  if (iconSvg) {
    const icon = el("span", "tt-inspector__icon");
    icon.innerHTML = iconSvg;
    head.append(icon);
  }
  const text = el("span");
  text.textContent = label;
  head.append(text);
  return head;
}

/** Segmented multi-select toggle for combinable roles (e.g. OHS + PL). */
function roleToggle<T extends string>(opts: {
  label: string;
  all: readonly T[];
  selected: T[];
  onChange: (next: T[]) => void;
  disabledReason?: (role: T) => string | null;
}): HTMLElement {
  const wrap = el("div", "tt-field");
  const label = el("span", "tt-field__label");
  label.textContent = opts.label;
  const switchEl = el("div", "tt-switch");
  switchEl.setAttribute("role", "group");
  for (const role of opts.all) {
    const reason = opts.disabledReason?.(role) ?? null;
    const active = opts.selected.includes(role);
    const button = el(
      "button",
      "tt-switch__opt" + (active ? " is-active" : "") + (reason ? " is-disabled" : ""),
    );
    button.type = "button";
    button.setAttribute("aria-pressed", String(active));
    if (reason) button.setAttribute("aria-disabled", "true");
    button.textContent = role;
    if (reason) {
      const tip = el("span", "tt-tip");
      tip.textContent = reason;
      button.append(tip);
    }
    button.addEventListener("click", () => {
      if (reason) return;
      opts.onChange(active ? opts.selected.filter((r) => r !== role) : [...opts.selected, role]);
    });
    switchEl.append(button);
  }
  wrap.append(label, switchEl);
  return wrap;
}

/** Single-select segmented switch for mutually-exclusive roles (e.g. ACL vs CF). */
function roleSwitch<T extends string>(opts: {
  label: string;
  all: readonly T[];
  value: T | null;
  onChange: (next: T | null) => void;
  disabledReason?: (role: T) => string | null;
}): HTMLElement {
  const wrap = el("div", "tt-field");
  const label = el("span", "tt-field__label");
  label.textContent = opts.label;
  const switchEl = el("div", "tt-switch");
  switchEl.setAttribute("role", "group");
  const options: Array<T | null> = [null, ...opts.all];
  for (const option of options) {
    const reason = option ? (opts.disabledReason?.(option) ?? null) : null;
    const active = opts.value === option;
    const button = el(
      "button",
      "tt-switch__opt" + (active ? " is-active" : "") + (reason ? " is-disabled" : ""),
    );
    button.type = "button";
    button.setAttribute("aria-pressed", String(active));
    if (reason) button.setAttribute("aria-disabled", "true");
    button.textContent = option ?? "None";
    if (reason) {
      const tip = el("span", "tt-tip");
      tip.textContent = reason;
      button.append(tip);
    }
    button.addEventListener("click", () => {
      if (reason) return;
      opts.onChange(option);
    });
    switchEl.append(button);
  }
  wrap.append(label, switchEl);
  return wrap;
}

const SWAP_ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M7 4 3 8l4 4" /><path d="M3 8h13" /><path d="m17 20 4-4-4-4" /><path d="M21 16H8" /></svg>';

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------

function contextPanel(context: CmContext, cmModeling: CmModeling, modeling: Modeling): HTMLElement {
  const type = context.subdomainType;
  const spec = type ? SUBDOMAIN_TYPE_SPECS[type] : undefined;
  const content = el("div", "tt-inspector__content");

  content.append(
    header(type ? subdomainIconSvg(type, 26) : null, spec?.label ?? "Bounded Context"),
  );

  content.append(
    field(
      "Subdomain type",
      dropdown(
        [
          { value: "", label: "Unclassified" },
          ...SUBDOMAIN_TYPES.map((t) => ({ value: t, label: SUBDOMAIN_TYPE_SPECS[t].label })),
        ],
        type ?? "",
        (value) => cmModeling.setSubdomainType(context, (value || undefined) as SubdomainType),
      ),
    ),
  );

  content.append(
    field(
      "Name",
      commitInput({
        value: context.cmLabel ?? "",
        ariaLabel: "Context name",
        onCommit: (label) => {
          const next = label.trim();
          if (next) cmModeling.updateLabel(context, next);
        },
      }),
    ),
  );

  content.append(
    field(
      "Owning team",
      commitInput({
        value: context.team ?? "",
        placeholder: "One team per context",
        ariaLabel: "Owning team",
        onCommit: (team) => cmModeling.setTeam(context, team.trim() || undefined),
      }),
    ),
  );

  content.append(
    field(
      "Description",
      commitInput({
        value: context.description ?? "",
        multiline: true,
        placeholder: "Purpose, ubiquitous language, notes…",
        ariaLabel: "Context description",
        onCommit: (description) => cmModeling.setDescription(context, description || undefined),
      }),
    ),
  );

  content.append(dangerButton("Delete context", () => modeling.removeElements([context])));
  return content;
}

function relationshipPanel(
  relationship: CmRelationship,
  modeler: Modeler,
  cmModeling: CmModeling,
  modeling: Modeling,
): HTMLElement {
  const spec = RELATIONSHIP_PATTERN_SPECS[relationship.pattern];
  const symmetric = isSymmetricPattern(relationship.pattern);
  const isCustomerSupplier = relationship.pattern === "customer-supplier";
  const content = el("div", "tt-inspector__content");

  content.append(header(relationshipIconSvg(relationship.pattern, 26), spec.label));

  // Pattern selector + swap-ends button.
  const patternField = el("div", "tt-field");
  const patternLabel = el("span", "tt-field__label");
  patternLabel.textContent = "Pattern";
  const patternRow = el("div", "tt-pattern-row");
  patternRow.append(
    dropdown(
      RELATIONSHIP_PATTERNS.map((p) => ({ value: p, label: RELATIONSHIP_PATTERN_SPECS[p].label })),
      relationship.pattern,
      (value) => cmModeling.setPattern(relationship, value as RelationshipPattern),
    ),
  );
  if (!symmetric) {
    const swap = el("button", "tt-swapbtn");
    swap.type = "button";
    swap.title = "Swap ends — reverse upstream/downstream";
    swap.setAttribute("aria-label", "Swap ends");
    swap.innerHTML = SWAP_ICON;
    swap.addEventListener("click", () => cmModeling.swapEnds(relationship));
    patternRow.append(swap);
  }
  patternField.append(patternLabel, patternRow);
  content.append(patternField);

  const meta = el("p", "tt-inspector__meta");
  meta.textContent = spec.description;
  content.append(meta);

  if (!symmetric) {
    content.append(
      roleToggle<UpstreamRole>({
        label: "Upstream roles (from) — OHS and/or PL",
        all: UPSTREAM_ROLES,
        selected: relationship.upstreamRoles ?? [],
        onChange: (next) => cmModeling.setUpstreamRoles(relationship, next),
        disabledReason: (role) =>
          isCustomerSupplier && role === "OHS"
            ? "Open Host Service is one-size-fits-all and not applicable in a customer-supplier relationship."
            : null,
      }),
    );
    content.append(
      roleSwitch<DownstreamRole>({
        label: "Downstream role (to) — ACL or CF, not both",
        all: DOWNSTREAM_ROLES,
        value: relationship.downstreamRoles?.[0] ?? null,
        onChange: (next) => cmModeling.setDownstreamRoles(relationship, next ? [next] : []),
        disabledReason: (role) =>
          isCustomerSupplier && role === "CF"
            ? "Conformist is not applicable in a customer-supplier relationship — a customer can negotiate."
            : null,
      }),
    );
  }

  content.append(
    field(
      "Label",
      commitInput({
        value: relationship.cmLabel ?? "",
        placeholder: "e.g. what is exchanged",
        ariaLabel: "Relationship label",
        onCommit: (label) => cmModeling.updateLabel(relationship, label.trim()),
      }),
    ),
  );

  content.append(
    field(
      "Description",
      commitInput({
        value: relationship.description ?? "",
        multiline: true,
        placeholder: "What flows here, contracts, notes…",
        ariaLabel: "Relationship description",
        onCommit: (description) =>
          cmModeling.setDescription(relationship, description || undefined),
      }),
    ),
  );

  content.append(
    field(
      "Implementation technology",
      commitInput({
        value: relationship.implementationTechnology ?? "",
        placeholder: "e.g. RESTful HTTP",
        ariaLabel: "Implementation technology",
        onCommit: (tech) =>
          cmModeling.setImplementationTechnology(relationship, tech.trim() || undefined),
      }),
    ),
  );

  // Live semantic findings for this relationship (from the whole-document rules).
  const report = validateDocument(modeler.exportDocument());
  const findings = [
    ...report.errors.map((f) => ({ ...f, kind: "error" as const })),
    ...report.warnings.map((f) => ({ ...f, kind: "warning" as const })),
  ].filter((f) => f.relationshipId === relationship.id);

  if (findings.length > 0) {
    const list = el("ul", "tt-findings");
    for (const finding of findings) {
      const item = el("li", `tt-finding tt-finding--${finding.kind}`);
      item.textContent = `${finding.kind === "error" ? "⛔" : "⚠️"} ${finding.message}`;
      list.append(item);
    }
    content.append(list);
  }

  content.append(
    dangerButton("Delete relationship", () => modeling.removeElements([relationship])),
  );
  return content;
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

export function mountInspector(modeler: Modeler, root: HTMLElement): void {
  const aside = el("aside", "tt-inspector");
  aside.setAttribute("aria-label", "Inspector");
  aside.hidden = true;
  root.append(aside);

  const selection = modeler.get<Selection>("selection");
  const cmModeling = modeler.get<CmModeling>("cmModeling");
  const modeling = modeler.get<Modeling>("modeling");

  const render = (): void => {
    const chosen = selection.get();
    const selected = chosen.length === 1 ? chosen[0] : null;
    if (isCmContext(selected)) {
      aside.replaceChildren(contextPanel(selected as CmContext, cmModeling, modeling));
      aside.hidden = false;
    } else if (isCmRelationship(selected)) {
      aside.replaceChildren(
        relationshipPanel(selected as CmRelationship, modeler, cmModeling, modeling),
      );
      aside.hidden = false;
    } else {
      aside.replaceChildren();
      aside.hidden = true;
    }
  };

  // Re-render on selection AND on model mutations, so live edits and the
  // semantic findings stay in sync (mirrors the webapp's revision bump).
  modeler.on("selection.changed", render);
  modeler.on("elements.changed", render);
  modeler.on("commandStack.changed", render);
  modeler.on("import.done", render);
  render();
}
