/**
 * The notation legend's content — subdomain types, integration roles and relationship patterns —
 * driven entirely by the notation spec, so it can never drift from what the canvas draws. The
 * Miragon modeler shell renders it into its legend card (`legend.render`); the rows use the
 * shell's row classes, so they look like every other modeler's legend.
 */

import {
  ALL_PATTERN_SPECS,
  ALL_SUBDOMAIN_SPECS,
  DOWNSTREAM_ROLE_SPECS,
  UPSTREAM_ROLE_SPECS,
} from "@miragon/context-maps-schema-model";
import type { DownstreamRole, UpstreamRole } from "@miragon/context-maps-schema-model";
import { contextIconSvg, relationshipIconSvg, roleChipSvg } from "../draw/palette-icons.js";

export interface LegendRow {
  /** The 24px notation preview, as SVG markup (the palette's and the context pad's). */
  readonly preview: string;
  readonly label: string;
  /** What the notation means, for the row's tooltip. */
  readonly explanation: string;
}

export interface LegendGroup {
  readonly label: string;
  readonly rows: readonly LegendRow[];
}

const ROLES: ReadonlyArray<{
  token: UpstreamRole | DownstreamRole;
  label: string;
  description: string;
}> = [
  { token: "OHS", ...UPSTREAM_ROLE_SPECS.OHS },
  { token: "PL", ...UPSTREAM_ROLE_SPECS.PL },
  { token: "ACL", ...DOWNSTREAM_ROLE_SPECS.ACL },
  { token: "CF", ...DOWNSTREAM_ROLE_SPECS.CF },
];

/** The legend's groups and rows, in reading order. */
export function legendGroups(): LegendGroup[] {
  return [
    {
      label: "Subdomain types",
      rows: ALL_SUBDOMAIN_SPECS.map((spec) => ({
        preview: contextIconSvg(spec.type),
        label: spec.label,
        explanation: spec.description,
      })),
    },
    {
      label: "Integration roles",
      rows: ROLES.map((role) => ({
        preview: roleChipSvg(role.token),
        label: `${role.token} · ${role.label}`,
        explanation: role.description,
      })),
    },
    {
      label: "Relationship patterns",
      rows: ALL_PATTERN_SPECS.map((spec) => ({
        preview: relationshipIconSvg(spec.pattern),
        label: `${spec.abbreviation} · ${spec.label}`,
        explanation: spec.description,
      })),
    },
  ];
}

/**
 * The chrome tooltip of the host (the shell's `shell.tooltip`): shown after the hover delay, on
 * the chrome's tooltip layer above the legend, so a glass card's backdrop filter cannot clip it.
 */
export interface LegendTooltip {
  attach(control: HTMLElement, content: { label: string }): () => void;
}

export interface LegendRenderOptions {
  /** Explains each row on hover; without it the explanation is the row's hidden description. */
  readonly tooltip?: LegendTooltip | undefined;
}

/**
 * Renders the legend's rows into `body` (the shell's `legend.render`) and returns the function
 * that detaches their tooltips again.
 */
export function renderLegend(body: HTMLElement, options: LegendRenderOptions = {}): () => void {
  const detachers: Array<() => void> = [];
  legendGroups().forEach((group, index) => {
    if (index > 0) {
      const separator = document.createElement("div");
      separator.className = "cd-shell-legend-separator";
      separator.setAttribute("role", "separator");
      body.append(separator);
    }
    const groupElement = document.createElement("div");
    groupElement.className = "cm-legend-group";
    groupElement.setAttribute("role", "group");
    groupElement.setAttribute("aria-label", group.label);
    for (const row of group.rows) {
      const rowElement = document.createElement("div");
      rowElement.className = "cd-shell-legend-row cm-legend-row";
      const preview = document.createElement("span");
      preview.className = "cd-shell-legend-preview";
      preview.innerHTML = row.preview;
      const label = document.createElement("span");
      label.textContent = row.label;
      rowElement.append(preview, label);
      if (options.tooltip) {
        detachers.push(options.tooltip.attach(rowElement, { label: row.explanation }));
      } else {
        const explanation = document.createElement("span");
        explanation.className = "cm-visually-hidden";
        explanation.textContent = `: ${row.explanation}`;
        rowElement.append(explanation);
      }
      groupElement.append(rowElement);
    }
    body.append(groupElement);
  });
  return () => {
    for (const detach of detachers.splice(0)) detach();
  };
}
