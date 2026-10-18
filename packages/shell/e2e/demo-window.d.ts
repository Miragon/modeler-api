// The demo's debug handle, as far as the e2e specs read it.
import type { DiagramJsConnection } from "../src/diagram-js.js";
import type { ShellHandle } from "../src/index.js";

declare global {
  interface Window {
    __demo?: {
      ready: boolean;
      calls: string[];
      shell: ShellHandle;
      connection: DiagramJsConnection;
      destroy(): void;
    };
  }
}
