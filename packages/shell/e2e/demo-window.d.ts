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
      /**
       * One fault each for the saboteur specs (`DemoFlaws` in demo/demo-diagram.ts), read at the
       * moment it matters, so a spec may switch it on after the page opened.
       */
      flaws: {
        /** Enter or Space on a creating palette entry adds nothing (case `create`). */
        noKeyboardCreate: boolean;
        /** The read-only lock leaves context pad, move and delete working (case `readOnly`). */
        canvasUnlocked: boolean;
        /** Cmd/Ctrl+A on the canvas does nothing, so VS Code runs its Select All (case `keys`). */
        noSelectAll: boolean;
      };
      /**
       * The invalid-file state as a host shows it: `shell.setReadOnly(true)` and the status box,
       * both with `INVALID_STATUS_DELAY_MS`; `false` clears both at once. `?invalid` uses it.
       */
      setInvalid(invalid: boolean): void;
      destroy(): void;
    };
  }
}
