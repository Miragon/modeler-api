import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createNonce, renderWebviewHtml, type WebviewHtmlOptions } from "./index.js";

const CSP_SOURCE = "https://*.vscode-cdn.net";
const NONCE = "abcDEF0123456789abcDEF0123456789";

function options(overrides: Partial<WebviewHtmlOptions> = {}): WebviewHtmlOptions {
  return {
    cspSource: CSP_SOURCE,
    scriptUri: "https://file+.vscode-resource.vscode-cdn.net/ext/dist/webview.js",
    styleUris: [
      "https://file+.vscode-resource.vscode-cdn.net/ext/dist/tokens.css",
      "https://file+.vscode-resource.vscode-cdn.net/ext/dist/webview.css",
    ],
    title: "Event Storming Board",
    lang: "en",
    appearance: { theme: "light" },
    nonce: NONCE,
    ...overrides,
  };
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

interface HappyDomSettings {
  handleDisabledFileLoadingAsSuccess: boolean;
}
const happyDomSettings = (window as unknown as { happyDOM?: { settings: HappyDomSettings } })
  .happyDOM?.settings;
const loadingWasSuccess = happyDomSettings?.handleDisabledFileLoadingAsSuccess;

beforeAll(() => {
  if (happyDomSettings) happyDomSettings.handleDisabledFileLoadingAsSuccess = true;
});

afterAll(() => {
  if (happyDomSettings)
    happyDomSettings.handleDisabledFileLoadingAsSuccess = loadingWasSuccess ?? false;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("renderWebviewHtml", () => {
  it("writes lang, the document class and data-cd-theme on <html>, always (also light)", () => {
    const html = renderWebviewHtml(options());
    expect(html).toContain('<html lang="en" class="cd-shell-document" data-cd-theme="light">');
    expect(html).not.toContain("data-cd-kontrast");
  });

  it("writes data-cd-kontrast only when the appearance has it", () => {
    const html = renderWebviewHtml(options({ appearance: { theme: "dark", kontrast: "hoch" } }));
    expect(html).toContain(
      '<html lang="en" class="cd-shell-document" data-cd-theme="dark" data-cd-kontrast="hoch">',
    );
    const root = parse(html).documentElement;
    expect(root.getAttribute("data-cd-theme")).toBe("dark");
    expect(root.getAttribute("data-cd-kontrast")).toBe("hoch");
  });

  it("starts with a doctype and declares UTF-8 and the viewport", () => {
    const html = renderWebviewHtml(options());
    expect(html.startsWith("<!doctype html>\n<html ")).toBe(true);
    expect(html).toContain('<meta charset="UTF-8" />');
    expect(html).toContain(
      '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    );
  });

  it("sets the CSP with data: fonts, inline styles and the nonce'd script source", () => {
    const document = parse(renderWebviewHtml(options()));
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    expect(csp?.getAttribute("content")).toBe(
      `default-src 'none'; img-src ${CSP_SOURCE} data: blob:; style-src ${CSP_SOURCE} 'unsafe-inline'; ` +
        `font-src ${CSP_SOURCE} data:; script-src 'nonce-${NONCE}'`,
    );
  });

  it("drops 'unsafe-inline' with inlineStyles: false", () => {
    const document = parse(renderWebviewHtml(options({ inlineStyles: false })));
    const csp = document
      .querySelector('meta[http-equiv="Content-Security-Policy"]')
      ?.getAttribute("content");
    expect(csp).toContain(`style-src ${CSP_SOURCE}; `);
    expect(csp).not.toContain("unsafe-inline");
  });

  it("puts the CSP before every stylesheet and keeps the stylesheet order", () => {
    const html = renderWebviewHtml(options());
    const cspAt = html.indexOf("Content-Security-Policy");
    const tokensAt = html.indexOf("tokens.css");
    const webviewAt = html.indexOf("webview.css");
    expect(cspAt).toBeGreaterThan(-1);
    expect(cspAt).toBeLessThan(tokensAt);
    expect(tokensAt).toBeLessThan(webviewAt);

    const links = [...parse(html).querySelectorAll('link[rel="stylesheet"]')];
    expect(links.map((link) => link.getAttribute("href"))).toEqual(options().styleUris);
  });

  it("renders no stylesheet without styleUris", () => {
    const { styleUris: _omitted, ...withoutStyles } = options();
    const html = renderWebviewHtml(withoutStyles);
    expect(html).not.toContain("<link");
  });

  it("renders the default body and the nonce'd script after it", () => {
    const html = renderWebviewHtml(options());
    expect(html).toContain('<div id="app"></div>');
    expect(html.indexOf('<div id="app"></div>')).toBeLessThan(html.indexOf("<script"));
    const script = parse(html).querySelector("script");
    expect(script?.getAttribute("nonce")).toBe(NONCE);
    expect(script?.getAttribute("src")).toBe(options().scriptUri);
    expect(parse(html).body.firstElementChild?.id).toBe("app");
  });

  it("renders a given body verbatim", () => {
    const body = '<main id="board" data-kind="storm"></main>';
    const html = renderWebviewHtml(options({ body }));
    expect(html).toContain(body);
    expect(html).not.toContain('<div id="app">');
  });

  it("escapes attribute values and the title", () => {
    const html = renderWebviewHtml(
      options({
        title: 'Board <script>alert("x")</script> & co',
        lang: 'en" onload="x',
        scriptUri: 'https://example.test/webview.js?a=1&b="2"',
        styleUris: ['https://example.test/a.css"><script>x</script>'],
        cspSource: 'https://a.test" http-equiv="refresh',
      }),
    );
    expect(html).toContain(
      "<title>Board &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co</title>",
    );
    expect(html).toContain('lang="en&quot; onload=&quot;x"');
    expect(html).toContain('src="https://example.test/webview.js?a=1&amp;b=&quot;2&quot;"');
    expect(html).toContain(
      'href="https://example.test/a.css&quot;&gt;&lt;script&gt;x&lt;/script&gt;"',
    );
    expect(html).not.toContain("<script>x</script>");

    const document = parse(html);
    expect(document.title).toBe('Board <script>alert("x")</script> & co');
    expect(document.documentElement.getAttribute("lang")).toBe('en" onload="x');
    expect(document.documentElement.hasAttribute("onload")).toBe(false);
    expect(document.querySelectorAll("script")).toHaveLength(1);
  });

  it("generates a nonce when none is given and uses it in CSP and script", () => {
    const { nonce: _omitted, ...withoutNonce } = options();
    const html = renderWebviewHtml(withoutNonce);
    const document = parse(html);
    const nonce = document.querySelector("script")?.getAttribute("nonce") ?? "";
    expect(nonce).toMatch(/^[A-Za-z0-9]{32}$/);
    expect(
      document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute("content"),
    ).toContain(`script-src 'nonce-${nonce}'`);
  });

  it("rejects a nonce that would break out of the CSP", () => {
    expect(() => renderWebviewHtml(options({ nonce: "abc' 'unsafe-inline" }))).toThrow(
      /invalid nonce/,
    );
    expect(() => renderWebviewHtml(options({ nonce: "" }))).toThrow(/invalid nonce/);
  });

  it.each(["https://a.test; script-src *", "https://a.test, script-src *", ";"])(
    "rejects the cspSource %j, which would add a directive of its own",
    (cspSource) => {
      expect(() => renderWebviewHtml(options({ cspSource }))).toThrow(/invalid cspSource/);
    },
  );

  it("takes a cspSource with several sources", () => {
    const document = parse(
      renderWebviewHtml(options({ cspSource: "https://a.test https://b.test" })),
    );
    expect(
      document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute("content"),
    ).toContain("img-src https://a.test https://b.test data: blob:;");
  });
});

describe("createNonce", () => {
  it("returns 32 characters [A-Za-z0-9]", () => {
    for (let run = 0; run < 50; run++) expect(createNonce()).toMatch(/^[A-Za-z0-9]{32}$/);
  });

  it("returns a different nonce every time", () => {
    const nonces = new Set(Array.from({ length: 200 }, () => createNonce()));
    expect(nonces.size).toBe(200);
  });

  it("draws from crypto.getRandomValues", () => {
    const getRandomValues = vi.spyOn(crypto, "getRandomValues");
    createNonce();
    expect(getRandomValues).toHaveBeenCalled();
  });

  it("skips bytes that would bias the alphabet", () => {
    let call = 0;
    vi.spyOn(crypto, "getRandomValues").mockImplementation(
      <T extends ArrayBufferView | null>(array: T): T => {
        const bytes = array as unknown as Uint8Array;
        bytes.fill(call === 0 ? 255 : 0);
        if (call === 0) {
          bytes[0] = 61;
          bytes[1] = 62;
        }
        call++;
        return array;
      },
    );
    expect(createNonce()).toBe(`9A${"A".repeat(30)}`);
  });
});
