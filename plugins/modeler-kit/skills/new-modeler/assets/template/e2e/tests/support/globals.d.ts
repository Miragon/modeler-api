import type { CollaborativeDiagram } from '@miragon/__NOTATION__-renderer';
import type { ShellHandle } from '@miragon/modeler-shell';
import type { DiagramJsConnection } from '@miragon/modeler-shell/diagram-js';

/** What the test pages publish for the suite; the shipped bundles publish nothing. */
declare global {
  interface Window {
    /** The VS Code webview test page: true once the first `init` import settled. */
    webviewReady?: boolean;
    shell?: ShellHandle;
    modeler?: CollaborativeDiagram;
    connection?: DiagramJsConnection;
    /** The web app (apps/webapp/src/main.ts). */
    app?: {
      ready: boolean;
      shell: ShellHandle;
      modeler: CollaborativeDiagram;
      connection: DiagramJsConnection;
      destroy(): void;
    };
  }
}
