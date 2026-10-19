import type { ShellMessages } from "../../core/index.js";
import { createElement } from "../element.js";
import type { LegalLineOptions } from "../types.js";

/** The Miragon legal pages (corporate-identity, skill docs-site, `miragon/legal.ts`). */
export const MIRAGON_HOME = "https://www.miragon.io/";
export const MIRAGON_IMPRESSUM = "https://www.miragon.io/impressum/";
export const MIRAGON_DATENSCHUTZ = "https://www.miragon.io/datenschutz/";

export interface LegalLineContext {
  ownerDocument: Document;
  messages: ShellMessages;
  options: LegalLineOptions;
}

export interface LegalLineController {
  /** The `<nav data-chrome="legal">`. */
  readonly element: HTMLElement;
  destroy(): void;
}

/**
 * `<nav class="cd-shell-legal" data-chrome="legal" aria-label="Legal">` (guide §5.10, §2): one
 * line, 13px, line height 20px, at `left: 12px; bottom: 12px`, glass without border and shadow,
 * padding `0 8px`, radius `sm`, layer 20. Links in `--cd-ui-link`, `target="_blank"
 * rel="noopener noreferrer"`, separated by `<span aria-hidden="true">·</span>`:
 * `messages.copyright(year)` → `MIRAGON_HOME`, "Impressum" → `MIRAGON_IMPRESSUM` and "Datenschutz"
 * → `MIRAGON_DATENSCHUTZ` (both `lang="de"`, never translated), then `options.links`.
 */
export function createLegalLine(context: LegalLineContext): LegalLineController {
  // TODO(web-chrome): links, separators, lang="de", year.
  const { ownerDocument, messages } = context;
  const element = createElement(ownerDocument, "nav", {
    class: "cd-shell-legal",
    "data-chrome": "legal",
    "aria-label": messages.legal,
  });
  return {
    element,
    destroy() {
      element.remove();
    },
  };
}
