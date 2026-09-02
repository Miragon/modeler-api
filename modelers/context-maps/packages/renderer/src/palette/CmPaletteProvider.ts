/**
 * The floating tool palette (horizontal pill, top-centre): the lasso tool
 * first, then drag-to-create for the three subdomain types of bounded
 * context. Relationships are drawn via the context pad's connect arrow, not
 * from the palette.
 */

import type Palette from "diagram-js/lib/features/palette/Palette";
import type Create from "diagram-js/lib/features/create/Create";
import type LassoTool from "diagram-js/lib/features/lasso-tool/LassoTool";
import type {
  PaletteEntries,
  default as PaletteProvider,
} from "diagram-js/lib/features/palette/PaletteProvider";
import type { Element } from "diagram-js/lib/model/Types";
import { ALL_SUBDOMAIN_SPECS } from "@miragon/context-maps-schema-model";
import { contextIconSvg } from "../draw/palette-icons.js";
import { lassoIconMarkup } from "../draw/icons.js";
import type CmElementFactory from "../model/CmElementFactory.js";

/** diagram-js highlights tools only inside the group named exactly `tools`. */
const GROUP_TOOLS = "tools";
const GROUP_CONTEXTS = "cm-1-contexts";

function entryHtml(icon: string, title: string, draggable = true): string {
  const drag = draggable ? ` draggable="true"` : "";
  return `<div class="entry cm-palette-entry"${drag} title="${title}">${icon}</div>`;
}

export default class CmPaletteProvider implements PaletteProvider {
  static $inject = ["palette", "create", "lassoTool", "cmElementFactory"];

  constructor(
    palette: Palette,
    private readonly create: Create,
    private readonly lassoTool: LassoTool,
    private readonly factory: CmElementFactory,
  ) {
    palette.registerProvider(this);
  }

  getPaletteEntries(): PaletteEntries {
    const entries: PaletteEntries = {};

    // Entry keys must end in `-tool` ("lasso-tool" ↔ tool "lasso") for
    // diagram-js' tool-manager highlight to find them; Esc cancels any tool.
    const lassoTitle = "Lasso tool — drag a box to select multiple elements";
    entries["lasso-tool"] = {
      group: GROUP_TOOLS,
      title: lassoTitle,
      html: entryHtml(lassoIconMarkup(), lassoTitle, false),
      action: {
        click: (event: Event) => this.lassoTool.activateSelection(event as MouseEvent),
      },
    };

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

    return entries;
  }
}
