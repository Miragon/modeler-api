import type { ShellHandle, ShellOptions } from "../../dom/index.js";
import type { AppearanceListenerOptions } from "./appearance.js";

export interface VsCodeShellOptions
  extends Omit<ShellOptions, "host" | "keyScope">, AppearanceListenerOptions {}

/**
 * `mountShell` for a VS Code webview: `host: "ide"`, the key listener on `document` (VS Code's own
 * listener sits on `window`, so handled keys are stopped before it), `cd-shell-document` on
 * `<html>`, plus `connectAppearance`. `destroy()` also disconnects the appearance listener.
 */
export function mountVsCodeShell(root: HTMLElement, options: VsCodeShellOptions): ShellHandle {
  throw new Error("@miragon/modeler-shell: mountVsCodeShell is not implemented yet");
}
