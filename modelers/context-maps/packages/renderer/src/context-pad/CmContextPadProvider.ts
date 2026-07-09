/**
 * Context-pad actions. Only "connect" (drawing a relationship from a context) is
 * offered here — rename and delete are done via the inspector sidebar, so the
 * pad stays minimal. Relationships get no pad entries.
 */

import type ContextPad from "diagram-js/lib/features/context-pad/ContextPad";
import type Connect from "diagram-js/lib/features/connect/Connect";
import type {
  ContextPadEntries,
  default as ContextPadProvider,
} from "diagram-js/lib/features/context-pad/ContextPadProvider";
import type { Element } from "diagram-js/lib/model/Types";
import { isCmContext } from "../model/di-types.js";
import { ICON_ARROW_FORWARD, iconMarkup } from "../draw/icons.js";

function cpHtml(path: string, title: string): string {
  return `<div class="entry cm-cp-entry" title="${title}">${iconMarkup(path)}</div>`;
}

export default class CmContextPadProvider implements ContextPadProvider {
  static $inject = ["contextPad", "connect"];

  constructor(
    contextPad: ContextPad,
    private readonly connect: Connect,
  ) {
    contextPad.registerProvider(this);
  }

  getContextPadEntries(element: Element): ContextPadEntries {
    if (!isCmContext(element)) return {};
    return {
      connect: {
        group: "connect",
        title: "Connect to another context",
        html: cpHtml(ICON_ARROW_FORWARD, "Connect"),
        action: {
          click: (event: Event) => this.connect.start(event as MouseEvent, element),
          dragstart: (event: Event) => this.connect.start(event as MouseEvent, element),
        },
      },
    };
  }
}
