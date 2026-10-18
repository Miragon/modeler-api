import type { Appearance } from "../../core/index.js";

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

/** 32 characters `[A-Za-z0-9]` from `crypto.getRandomValues`. */
export function createNonce(): string {
  throw new Error("@miragon/modeler-shell: createNonce is not implemented yet");
}

/**
 * The webview document: `<html lang class="cd-shell-document" data-cd-theme [data-cd-kontrast]>`,
 * strict CSP (`default-src 'none'`, `img-src <cspSource> data: blob:`, `style-src <cspSource>
 * 'unsafe-inline'`, `font-src <cspSource> data:`, `script-src 'nonce-…'`), the stylesheets, `body`
 * and the nonce'd script. Attribute values are escaped.
 */
export function renderWebviewHtml(options: WebviewHtmlOptions): string {
  throw new Error("@miragon/modeler-shell: renderWebviewHtml is not implemented yet");
}
