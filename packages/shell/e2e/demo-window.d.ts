// The demo's debug handle, as far as the e2e specs read it.
import type { DiagramJsConnection } from "../src/diagram-js.js";
import type { ShellHandle } from "../src/index.js";
import type { VsCodeWebviewStub } from "../src/testing-vscode-stub.js";

declare global {
  interface Window {
    __demo?: {
      ready: boolean;
      calls: string[];
      shell: ShellHandle;
      connection: DiagramJsConnection;
      /** The stubbed VS Code around the `ide` host. */
      vscode?: VsCodeWebviewStub;
      destroy(): void;
    };
  }
}
