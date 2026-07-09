/**
 * The floating tool palette (styled top-centre, Excalidraw style):
 * drag-to-create the three subdomain types of bounded context. Relationships
 * are drawn via the context pad's connect arrow, not from the palette.
 */

import type Palette from "diagram-js/lib/features/palette/Palette";
import type Create from "diagram-js/lib/features/create/Create";
import type {
  PaletteEntries,
  default as PaletteProvider,
} from "diagram-js/lib/features/palette/PaletteProvider";
import type { Element } from "diagram-js/lib/model/Types";
import { ALL_SUBDOMAIN_SPECS } from "@miragon/context-maps-schema-model";
import { contextIconSvg } from "../draw/palette-icons.js";
import type CmElementFactory from "../model/CmElementFactory.js";

const GROUP_CONTEXTS = "cm-1-contexts";

function entryHtml(icon: string, title: string): string {
  return `<div class="entry cm-palette-entry" draggable="true" title="${title}">${icon}</div>`;
}

export default class CmPaletteProvider implements PaletteProvider {
  static $inject = ["palette", "create", "cmElementFactory"];

  constructor(
    palette: Palette,
    private readonly create: Create,
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

    return entries;
  }
}
