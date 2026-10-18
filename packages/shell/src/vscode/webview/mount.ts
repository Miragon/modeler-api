import { mountShell, type ShellHandle, type ShellOptions } from "../../dom/index.js";
import { connectAppearance, type AppearanceListenerOptions } from "./appearance.js";

export interface VsCodeShellOptions
  extends Omit<ShellOptions, "host" | "keyScope">, AppearanceListenerOptions {}

/** The shell's handle with a `destroy` that runs `beforeDestroy` first; every other member delegates. */
function withDestroyHook(shell: ShellHandle, beforeDestroy: () => void): ShellHandle {
  return {
    get root() {
      return shell.root;
    },
    get canvas() {
      return shell.canvas;
    },
    get host() {
      return shell.host;
    },
    get lang() {
      return shell.lang;
    },
    get platform() {
      return shell.platform;
    },
    get messages() {
      return shell.messages;
    },
    get menu() {
      return shell.menu;
    },
    get tooltip() {
      return shell.tooltip;
    },
    get legend() {
      return shell.legend;
    },
    get inspector() {
      return shell.inspector;
    },
    setZoomTarget: (target) => shell.setZoomTarget(target),
    fitInsets: () => shell.fitInsets(),
    registerPalette: (palette) => shell.registerPalette(palette),
    setProblems: (summary) => shell.setProblems(summary),
    setStatus: (status, options) => shell.setStatus(status, options),
    setEmptyHint: (visible) => shell.setEmptyHint(visible),
    setReadOnly: (readOnly) => shell.setReadOnly(readOnly),
    isReadOnly: () => shell.isReadOnly(),
    destroy() {
      beforeDestroy();
      shell.destroy();
    },
  };
}

/**
 * `mountShell` for a VS Code webview: `host: "ide"`, the key listener on `document` (VS Code's own
 * listener sits on `window`, so handled keys are stopped before it), `cd-shell-document` on
 * `<html>`, plus `connectAppearance`. `destroy()` also disconnects the appearance listener.
 */
export function mountVsCodeShell(root: HTMLElement, options: VsCodeShellOptions): ShellHandle {
  const { themes, ...shellOptions } = options;
  const disconnectAppearance = connectAppearance({ themes });
  let shell: ShellHandle;
  try {
    shell = mountShell(root, { ...shellOptions, host: "ide", keyScope: "document" });
  } catch (error) {
    disconnectAppearance();
    throw error;
  }
  return withDestroyHook(shell, disconnectAppearance);
}
