import {
  installVsCodeWebviewStub,
  stubOptionsFromSearch,
} from '@miragon/modeler-shell/testing/vscode-stub';
import { EXAMPLE_DIAGRAM } from '../../apps/vscode/src/examples.js';
import { WEBVIEW_THEMES } from '../../apps/vscode/src/themes.js';

// The stub stands in for VS Code (default styles, <html> as renderWebviewHtml writes it, the
// body's theme classes, acquireVsCodeApi, the theme bridge) and must be in place before the
// webview runs.
installVsCodeWebviewStub({ ...stubOptionsFromSearch(location.search), themes: WEBVIEW_THEMES });
const { webview } = await import('../../apps/vscode/src/webview/main.js');

// For the tests only: the shipped bundle publishes nothing on window.
window.shell = webview.shell;
window.modeler = webview.modeler;
window.connection = webview.connection;
void webview.ready.then(() => {
  window.webviewReady = true;
});

// There is no extension host: post the document the way the extension would.
window.postMessage({ type: 'init', text: EXAMPLE_DIAGRAM }, '*');
