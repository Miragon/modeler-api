/**
 * The floating tool palette (styled top-centre, Excalidraw style):
 *  - drag-to-create the three subdomain types of bounded context;
 *  - a global "connect" tool to draw relationships between two contexts.
 */

import type Palette from "diagram-js/lib/features/palette/Palette";
import type Create from "diagram-js/lib/features/create/Create";
import type GlobalConnect from "diagram-js/lib/features/global-connect/GlobalConnect";
import type {
  PaletteEntries,
  default as PaletteProvider,
} from "diagram-js/lib/features/palette/PaletteProvider";
import type { Element } from "diagram-js/lib/model/Types";
import { ALL_SUBDOMAIN_SPECS } from "@miragon/context-maps-schema-model";
import { contextIconSvg, relationshipIconSvg } from "../draw/palette-icons.js";
import type CmElementFactory from "../model/CmElementFactory.js";

const GROUP_CONTEXTS = "cm-1-contexts";
// Must be exactly "tools": diagram-js' Palette.updateToolHighlight hard-queries
// `[data-group=tools]` on every tool activation and throws if it's missing.
const GROUP_TOOLS = "tools";

function entryHtml(icon: string, title: string): string {
  return `<div class="entry cm-palette-entry" draggable="true" title="${title}">${icon}</div>`;
}

export default class CmPaletteProvider implements PaletteProvider {
  static $inject = ["palette", "create", "globalConnect", "cmElementFactory"];

  constructor(
    palette: Palette,
    private readonly create: Create,
    private readonly globalConnect: GlobalConnect,
    private readonly factory: CmElementFactory,
  ) {
    palette.registerProvider(this);
  }

  getPaletteEntries(): PaletteEntries {
    const entries: PaletteEntries = {};

    for (const spec of ALL_SUBDOMAIN_SPECS) {
      const start = (event: Event) =>
        this.create.start(
          event as MouseEvent,
          this.factory.createNewContext(spec.type, spec.label) as unknown as Element,
        );
      entries[`context.${spec.type}`] = {
        group: GROUP_CONTEXTS,
        title: `${spec.label} — ${spec.description}`,
        html: entryHtml(contextIconSvg(spec.type), `${spec.label} — ${spec.description}`),
        action: { dragstart: start, click: start },
      };
    }

    const startConnect = (event: Event) => this.globalConnect.start(event as MouseEvent, false);
    // Key "global-connect-tool": diagram-js highlights the active tool by this id.
    entries["global-connect-tool"] = {
      group: GROUP_TOOLS,
      title: "Relationship — connect two contexts, then choose the pattern",
      html: entryHtml(relationshipIconSvg(), "Relationship — connect two contexts"),
      action: { dragstart: startConnect, click: startConnect },
    };

    return entries;
  }
}
