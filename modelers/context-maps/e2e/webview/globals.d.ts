import type { CollaborativeContextMapsModeler } from "@miragon/context-maps-renderer";
import type { ShellHandle } from "@miragon/modeler-shell";
import type { DiagramJsConnection } from "@miragon/modeler-shell/diagram-js";
import type { VsCodeWebviewStub } from "@miragon/modeler-shell/testing/vscode-stub";

/*
 * The webview test page (e2e/webview/webview-test.html) runs apps/vscode/src/webview/main.ts inside
 * the shell's VS Code stub and publishes the webview's parts on window for the tests.
 */
declare global {
  interface Window {
    __modelerShellVsCodeStub?: VsCodeWebviewStub;
    /** True once the first `init` import has settled, valid or not. */
    webviewReady?: boolean;
    shell?: ShellHandle;
    modeler?: CollaborativeContextMapsModeler;
    connection?: DiagramJsConnection;
  }
}
