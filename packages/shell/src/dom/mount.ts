import type { ShellHandle, ShellOptions } from "./types.js";

/**
 * Turns `root` into the shell (`.cd-shell`, container `cd-shell`) and renders the chrome in the
 * DOM order of guide §5.14: menu trigger, canvas slot, status box, empty-file hint, inspector,
 * problems pill, legend, zoom panel, then the layer for dropdown and tooltip. Installs the one
 * `keydown` listener (see `ShellOptions.keyScope`) and the root `ResizeObserver`.
 *
 * `root` must get its size from outside (`container-type: size`): `height: 100%` in an own
 * document, an explicitly sized element in a foreign page.
 */
export function mountShell(root: HTMLElement, options: ShellOptions): ShellHandle {
  throw new Error("@miragon/modeler-shell: mountShell is not implemented yet");
}
