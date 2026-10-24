/**
 * The notation legend for a host's legend card (the modeler shell's `legend.render`, or a panel of
 * the host's own): each shape of the notation with its name and a short explanation, grouped into
 * team types, interaction modes and the other elements. Driven by the notation spec and drawn with
 * the palette's glyphs, so it shows the official notation colours and can never drift from what
 * the canvas draws. `legendGroups` is DOM-free data; `renderLegend` turns it into rows with the
 * shell's row, preview and separator classes next to its own, which the renderer's stylesheet lays
 * out the same, so the rows look alike with and without the shell.
 */

import {
  ALL_INTERACTION_SPECS,
  ALL_TEAM_SPECS,
  ANNOTATION_SPEC,
  FLOW_SPEC,
  type InteractionMode,
  type TeamType,
} from "@miragon/team-topologies-schema-model";
import {
  annotationIconSvg,
  flowIconSvg,
  interactionIconSvg,
  teamIconSvg,
} from "../draw/palette-icons.js";

export interface LegendRow {
  /** The palette's glyph as SVG markup, so legend and palette always show the same shape. */
  readonly preview: string;
  readonly label: string;
  /** One short line under the name: what the shape stands for. */
  readonly explanation: string;
}

export interface LegendGroup {
  readonly label: string;
  /** The visible heading: the group and what its shapes share (solid or dashed). */
  readonly heading: string;
  readonly rows: readonly LegendRow[];
}

const TEAM_TYPE_EXPLANATIONS: Readonly<Record<TeamType, string>> = {
  "stream-aligned": "Delivers one stream of work",
  enabling: "Coaches teams in new skills",
  "complicated-subsystem": "Owns a specialist subsystem",
  platform: "Self-service for other teams",
};

const INTERACTION_MODE_EXPLANATIONS: Readonly<Record<InteractionMode, string>> = {
  collaboration: "Teams work closely for a time",
  "x-as-a-service": "One provides, one consumes",
  facilitating: "One team helps another learn",
};

/**
 * The legend's groups and rows, in reading order. It carries the notation primer: what each team
 * type and interaction mode is for, and that solid shapes are long-lived teams while dashed ones
 * are short-lived interactions.
 */
export function legendGroups(): LegendGroup[] {
  return [
    {
      label: "Team types",
      heading: "Teams: solid, long-lived",
      rows: ALL_TEAM_SPECS.map((spec) => ({
        preview: teamIconSvg(spec.type),
        label: spec.label,
        explanation: TEAM_TYPE_EXPLANATIONS[spec.type],
      })),
    },
    {
      label: "Interaction modes",
      heading: "Interactions: dashed, short-lived",
      rows: ALL_INTERACTION_SPECS.map((spec) => ({
        preview: interactionIconSvg(spec.mode),
        label: spec.label,
        explanation: INTERACTION_MODE_EXPLANATIONS[spec.mode],
      })),
    },
    {
      label: "Other elements",
      heading: "Other elements",
      rows: [
        {
          preview: flowIconSvg(),
          label: FLOW_SPEC.label,
          explanation: "Change flows left to right",
        },
        {
          preview: annotationIconSvg(),
          label: ANNOTATION_SPEC.label,
          explanation: "Rationale, questions, plans",
        },
      ],
    },
  ];
}

/**
 * Renders the legend's rows into `body` (the shell's `legend.render`) and returns the function
 * that removes them again. The explanation stands under each name, so the rows need no tooltip.
 */
export function renderLegend(body: HTMLElement): () => void {
  const document = body.ownerDocument;
  const rendered: Element[] = [];
  legendGroups().forEach((group, index) => {
    if (index > 0) {
      // A <div>, not an <hr>: it brings no browser border a host's own separator rule must reset.
      const separator = document.createElement("div");
      separator.className = "cd-shell-legend-separator tt-legend__separator";
      separator.setAttribute("role", "separator");
      rendered.push(separator);
    }
    const heading = document.createElement("p");
    heading.className = "tt-legend__heading";
    heading.textContent = group.heading;
    const list = document.createElement("ul");
    list.className = "tt-legend__group";
    list.setAttribute("aria-label", group.label);
    for (const row of group.rows) {
      const item = document.createElement("li");
      item.className = "cd-shell-legend-row tt-legend__row";
      const preview = document.createElement("span");
      preview.className = "cd-shell-legend-preview tt-legend__preview";
      preview.setAttribute("aria-hidden", "true");
      // Static markup the renderer generates from the notation spec.
      preview.innerHTML = row.preview;
      const text = document.createElement("span");
      text.className = "tt-legend__text";
      const label = document.createElement("span");
      label.className = "tt-legend__label";
      label.textContent = row.label;
      const explanation = document.createElement("span");
      explanation.className = "tt-legend__explanation";
      explanation.textContent = row.explanation;
      // The space keeps name and explanation apart in the text a screen reader reads out.
      text.append(label, " ", explanation);
      item.append(preview, text);
      list.append(item);
    }
    rendered.push(heading, list);
  });
  body.append(...rendered);
  return () => {
    for (const node of rendered.splice(0)) node.remove();
  };
}
