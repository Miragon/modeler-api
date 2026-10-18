import { appearanceAttributes, type Appearance } from "../../core/index.js";

export interface WebviewHtmlOptions {
  /** `webview.cspSource` */
  cspSource: string;
  /** The bundle, `webview.asWebviewUri(…).toString()`. */
  scriptUri: string;
  /** Stylesheets in load order (token CSS first, see API.md). */
  styleUris?: readonly string[];
  /** `<title>` */
  title: string;
  /** The tool's UI language for `<html lang>`; English modelers pass `"en"`. */
  lang: string;
  /** Resolved appearance (`currentAppearance`), written before the first paint. */
  appearance: Appearance;
  /** Markup inside `<body>` before the script; default `<div id="app"></div>`. */
  body?: string;
  /** Script nonce; default `createNonce()`. */
  nonce?: string;
}

const NONCE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const NONCE_LENGTH = 32;
/** Bytes at or above this limit are rejected, so every character is equally likely. */
const UNBIASED_BYTE_LIMIT = 256 - (256 % NONCE_ALPHABET.length);
/** The `base64-value` of a CSP `nonce-source`. */
const CSP_NONCE = /^[A-Za-z0-9+/_-]+={0,2}$/;

const DEFAULT_BODY = '<div id="app"></div>';

/** 32 characters `[A-Za-z0-9]` from `crypto.getRandomValues`. */
export function createNonce(): string {
  let nonce = "";
  while (nonce.length < NONCE_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(NONCE_LENGTH))) {
      if (byte < UNBIASED_BYTE_LIMIT && nonce.length < NONCE_LENGTH) {
        nonce += NONCE_ALPHABET.charAt(byte % NONCE_ALPHABET.length);
      }
    }
  }
  return nonce;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function attribute(name: string, value: string): string {
  return `${name}="${escapeHtml(value)}"`;
}

function contentSecurityPolicy(cspSource: string, nonce: string): string {
  return [
    "default-src 'none'",
    `img-src ${cspSource} data: blob:`,
    `style-src ${cspSource} 'unsafe-inline'`,
    `font-src ${cspSource} data:`,
    `script-src 'nonce-${nonce}'`,
  ].join("; ");
}

/**
 * The webview document: `<html lang class="cd-shell-document" data-cd-theme [data-cd-kontrast]>`,
 * strict CSP (`default-src 'none'`, `img-src <cspSource> data: blob:`, `style-src <cspSource>
 * 'unsafe-inline'`, `font-src <cspSource> data:`, `script-src 'nonce-…'`), the stylesheets, `body`
 * and the nonce'd script. Attribute values and the title are escaped; `body` is markup and is not.
 * Throws for a `nonce` that is not a CSP base64 value.
 */
export function renderWebviewHtml(options: WebviewHtmlOptions): string {
  const nonce = options.nonce ?? createNonce();
  if (!CSP_NONCE.test(nonce)) {
    throw new Error(`@miragon/modeler-shell: renderWebviewHtml got an invalid nonce "${nonce}"`);
  }
  const appearance = appearanceAttributes(options.appearance);
  const kontrast = appearance["data-cd-kontrast"];
  const htmlAttributes = [
    attribute("lang", options.lang),
    attribute("class", "cd-shell-document"),
    attribute("data-cd-theme", appearance["data-cd-theme"]),
    ...(kontrast ? [attribute("data-cd-kontrast", kontrast)] : []),
  ].join(" ");
  const stylesheets = (options.styleUris ?? []).map(
    (uri) => `\n    <link ${attribute("rel", "stylesheet")} ${attribute("href", uri)} />`,
  );

  return `<!doctype html>
<html ${htmlAttributes}>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" ${attribute("content", contentSecurityPolicy(options.cspSource, nonce))} />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />${stylesheets.join("")}
    <title>${escapeHtml(options.title)}</title>
  </head>
  <body>
    ${options.body ?? DEFAULT_BODY}
    <script ${attribute("nonce", nonce)} ${attribute("src", options.scriptUri)}></script>
  </body>
</html>
`;
}
