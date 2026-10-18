// The demo's debug handle, as far as the e2e specs read it.
import type { DiagramJsConnection } from "../src/diagram-js.js";
import type { ShellHandle } from "../src/index.js";
import type { VsCodeHostStub } from "../demo/vscode-host-stub.js";

declare global {
  interface Window {
    __demo?: {
      ready: boolean;
      calls: string[];
      shell: ShellHandle;
      connection: DiagramJsConnection;
      /** The stubbed VS Code around the `ide` host. */
      vscode?: VsCodeHostStub;
      destroy(): void;
    };
  }
}
