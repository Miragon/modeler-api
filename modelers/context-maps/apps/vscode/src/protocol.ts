/**
 * Message protocol between the extension host and the webview.
 *
 * Data flow (classic CustomTextEditor pattern):
 *  - Host -> webview: `init`/`update` with the current document text (the native JSON document).
 *  - Webview -> host: `edit` after every graphical change (serialized JSON) -> WorkspaceEdit.
 *  - Webview -> host: `export` (SVG text or Base64 PNG) -> save dialog + write file.
 *
 * Only for the PNG editor (`*.cm.png`/`*.cm.png`, binary CustomDocument file):
 *  - Host -> webview: `requestPng` (with a correlation `id`) when the host needs the fully
 *    rasterized PNG (raster + embedded JSON) for saving/backup — rasterization only works in the browser.
 *  - Webview -> host: `pngResponse` (`id` + Base64 PNG OR `error`).
 *
 * Echo protection: the host suppresses re-import when a document change exactly matches the JSON
 * last sent by the webview (otherwise every own change would reset the canvas). The webview, in
 * turn, only sends an `edit` when the JSON actually differs from the last known text.
 */

/** File formats the webview can export to (text = UTF-8, PNG = Base64). */
export type ExportFormat = "svg" | "png" | "cml" | "json";

export type HostToWebview =
  /** Initial population after `ready`. */
  | { type: "init"; text: string }
  /** External document change (text editor, Git, …) -> re-import. */
  | { type: "update"; text: string }
  /** Reply to `importRequest`: a user-picked file to import into the current diagram. */
  | { type: "importFile"; name: string; text: string }
  /** PNG editor: request the current embedded PNG for save/backup (reply: `pngResponse`). */
  | { type: "requestPng"; id: number };

export type WebviewToHost =
  | { type: "ready" }
  /** Graphical change -> apply to the document as a WorkspaceEdit. */
  | { type: "edit"; text: string }
  /** Trigger an export (SVG/CML/JSON = text, PNG = Base64) -> save dialog + write file. */
  | { type: "export"; format: ExportFormat; data: string }
  /** Ask the host to open a file picker and stream the chosen file back (reply: `importFile`). */
  | { type: "importRequest" }
  /** Reply to `requestPng`: Base64 PNG (`data`) OR `error`. `id` correlates with the request. */
  | { type: "pngResponse"; id: number; data?: string; error?: string }
  | { type: "info"; message: string }
  | { type: "error"; message: string };
