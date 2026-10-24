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
  /** `cd-shell-legal-N`: the prefix of the id the links' `aria-describedby` names. */
  idPrefix: string;
}

export interface LegalLineController {
  /** The `<nav data-chrome="legal">`. */
  readonly element: HTMLElement;
  destroy(): void;
}

/**
 * `<nav class="cd-shell-legal" data-chrome="legal" aria-label="Legal">` (guide §5.10, §2): one
 * line, 13px, line height 20px, at `left: 12px; bottom: 12px`, glass without border and shadow,
 * padding `0 8px`, radius `sm`, layer 20; in a container too narrow for it, it wraps between its
 * entries and grows upwards. Links in `--cd-ui-link`, `target="_blank" rel="noopener noreferrer"`
 * and `aria-describedby` a hidden `messages.opensInNewTab`, each after the first in a
 * `<span class="cd-shell-legal-item">` with its separator `<span aria-hidden="true">·</span>`:
 * `messages.copyright(year)` → `MIRAGON_HOME`, "Impressum" → `MIRAGON_IMPRESSUM` and "Datenschutz"
 * → `MIRAGON_DATENSCHUTZ` (both `lang="de"`, never translated), then `options.links`.
 */
export function createLegalLine(context: LegalLineContext): LegalLineController {
  const { ownerDocument, messages, options } = context;
  const year = options.year ?? new Date().getFullYear();

  // Every link opens a new tab; screen readers hear that from one shared description.
  const newTabId = `${context.idPrefix}-new-tab`;
  const link = (label: string, href: string, lang?: string): HTMLAnchorElement =>
    createElement(
      ownerDocument,
      "a",
      { href, lang, target: "_blank", rel: "noopener noreferrer", "aria-describedby": newTabId },
      label,
    );
  const separator = (): HTMLElement =>
    createElement(ownerDocument, "span", { "aria-hidden": "true" }, "·");
  const item = (anchor: HTMLAnchorElement): HTMLElement =>
    createElement(ownerDocument, "span", { class: "cd-shell-legal-item" }, separator(), anchor);

  // The legal pages are German whatever the tool's language (guide §2), so their names are too.
  const links = [
    link(messages.copyright(year), MIRAGON_HOME),
    link("Impressum", MIRAGON_IMPRESSUM, "de"),
    link("Datenschutz", MIRAGON_DATENSCHUTZ, "de"),
    ...(options.links ?? []).map((extra) => link(extra.label, extra.href, extra.lang)),
  ];

  const element = createElement(ownerDocument, "nav", {
    class: "cd-shell-legal",
    "data-chrome": "legal",
    "aria-label": messages.legal,
  });
  element.append(
    ...links.map((anchor, index) => (index === 0 ? anchor : item(anchor))),
    createElement(ownerDocument, "span", { id: newTabId, hidden: "" }, messages.opensInNewTab),
  );

  return {
    element,
    destroy() {
      element.remove();
    },
  };
}
