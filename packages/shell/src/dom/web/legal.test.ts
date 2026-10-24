import { afterEach, describe, expect, it } from "vitest";

import { defaultMessages, resolveMessages } from "../../core/index.js";
import type { LegalLineOptions } from "../types.js";
import { MIRAGON_DATENSCHUTZ, MIRAGON_HOME, MIRAGON_IMPRESSUM, createLegalLine } from "./legal.js";

afterEach(() => {
  document.body.replaceChildren();
});

function legalLine(options: LegalLineOptions = {}, messages = defaultMessages) {
  const line = createLegalLine({
    ownerDocument: document,
    messages,
    options,
    idPrefix: "cd-shell-legal-1",
  });
  document.body.append(line.element);
  return line;
}

function links(element: HTMLElement) {
  return [...element.querySelectorAll("a")].map((anchor) => ({
    text: anchor.textContent,
    href: anchor.getAttribute("href"),
    lang: anchor.getAttribute("lang"),
  }));
}

describe("legal line (guide §5.10, §2)", () => {
  it("is a nav named Legal", () => {
    const { element } = legalLine();
    expect(element.tagName).toBe("NAV");
    expect(element.className).toBe("cd-shell-legal");
    expect(element.getAttribute("data-chrome")).toBe("legal");
    expect(element.getAttribute("aria-label")).toBe("Legal");
  });

  it("links the Miragon home page, Impressum and Datenschutz, then the modeler's links", () => {
    const { element } = legalLine({
      year: 2026,
      links: [
        { label: "GitHub", href: "https://github.com/Miragon/event-storming-modeler" },
        { label: "Quellcode", href: "https://example.org/", lang: "de" },
      ],
    });
    expect(links(element)).toEqual([
      { text: "© 2026 Miragon GmbH", href: MIRAGON_HOME, lang: null },
      { text: "Impressum", href: MIRAGON_IMPRESSUM, lang: "de" },
      { text: "Datenschutz", href: MIRAGON_DATENSCHUTZ, lang: "de" },
      { text: "GitHub", href: "https://github.com/Miragon/event-storming-modeler", lang: null },
      { text: "Quellcode", href: "https://example.org/", lang: "de" },
    ]);
  });

  it("uses the URLs of the corporate-identity legal kit", () => {
    expect(MIRAGON_HOME).toBe("https://www.miragon.io/");
    expect(MIRAGON_IMPRESSUM).toBe("https://www.miragon.io/impressum/");
    expect(MIRAGON_DATENSCHUTZ).toBe("https://www.miragon.io/datenschutz/");
  });

  it("opens every link in a new tab without opener or referrer", () => {
    const { element } = legalLine({
      links: [{ label: "GitHub", href: "https://github.com/Miragon" }],
    });
    for (const anchor of element.querySelectorAll("a")) {
      expect(anchor.getAttribute("target")).toBe("_blank");
      expect(anchor.getAttribute("rel")).toBe("noopener noreferrer");
    }
  });

  it("puts each link after the first behind a hidden middle dot, the two kept together when it wraps", () => {
    const { element } = legalLine({
      links: [{ label: "GitHub", href: "https://github.com/Miragon" }],
    });
    const items = [...element.querySelectorAll(":scope > .cd-shell-legal-item")];
    expect(element.firstElementChild?.tagName).toBe("A");
    expect(items).toHaveLength(3);
    for (const entry of items) {
      const [separator, anchor] = [...entry.children];
      expect(separator?.textContent).toBe("·");
      expect(separator?.getAttribute("aria-hidden")).toBe("true");
      expect(anchor?.tagName).toBe("A");
    }
  });

  it("tells screen readers once that the links open a new tab", () => {
    const { element } = legalLine();
    const description = element.querySelector<HTMLElement>("#cd-shell-legal-1-new-tab");
    expect(description?.hidden).toBe(true);
    expect(description?.textContent).toBe("Opens in a new tab");
    for (const anchor of element.querySelectorAll("a")) {
      expect(anchor.getAttribute("aria-describedby")).toBe("cd-shell-legal-1-new-tab");
    }
  });

  it("defaults the year to the current one", () => {
    const { element } = legalLine();
    expect(element.querySelector("a")?.textContent).toBe(
      `© ${new Date().getFullYear()} Miragon GmbH`,
    );
  });

  it("translates copyright and name, never Impressum and Datenschutz", () => {
    const messages = resolveMessages({
      legal: "Rechtliches",
      copyright: (year) => `© ${year} Miragon GmbH.`,
    });
    const { element } = legalLine({ year: 2027 }, messages);
    expect(element.getAttribute("aria-label")).toBe("Rechtliches");
    expect(links(element).map((link) => link.text)).toEqual([
      "© 2027 Miragon GmbH.",
      "Impressum",
      "Datenschutz",
    ]);
  });

  it("removes itself on destroy", () => {
    const line = legalLine();
    document.body.append(line.element);
    line.destroy();
    expect(line.element.isConnected).toBe(false);
  });
});
