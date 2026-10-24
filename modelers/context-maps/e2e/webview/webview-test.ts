import {
  installVsCodeWebviewStub,
  stubOptionsFromSearch,
} from "@miragon/modeler-shell/testing/vscode-stub";
import { serializeDocumentText, type CmDocument } from "@miragon/context-maps-schema-model";
import { EMPTY_MAP, EXAMPLE_MAP } from "../../apps/vscode/src/examples.js";
import { WEBVIEW_THEMES } from "../../apps/vscode/src/themes.js";
import { COMPACT_MAP } from "../tests/support/maps.js";

// The stub stands in for VS Code (default styles, <html> as renderWebviewHtml writes it, body
// theme classes, acquireVsCodeApi, theme bridge) and must be in place before the webview runs.
installVsCodeWebviewStub({ ...stubOptionsFromSearch(location.search), themes: WEBVIEW_THEMES });
const { webview } = await import("../../apps/vscode/src/webview/main.js");

// The tests drive the webview through these; the shipped bundle publishes nothing on window.
window.shell = webview.shell;
window.modeler = webview.modeler;
window.connection = webview.connection;
void webview.ready.then(() => {
  window.webviewReady = true;
});

const MAPS: Readonly<Record<string, string>> = {
  example: EXAMPLE_MAP,
  empty: EMPTY_MAP,
  compact: serializeDocumentText(COMPACT_MAP as CmDocument),
};
const map = new URLSearchParams(location.search).get("map") ?? "example";
window.postMessage({ type: "init", text: MAPS[map] ?? EXAMPLE_MAP }, "*");
