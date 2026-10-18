import type { Appearance, Theme } from "../../core/index.js";

/**
 * Writes `data-cd-theme` and `data-cd-kontrast` on `element` (default `<html>`) in one task, with
 * transitions suppressed for one frame: adds `cd-shell-no-transition` to `<html>`, sets both
 * attributes and removes the class in a nested `requestAnimationFrame`.
 */
export function applyAppearance(appearance: Appearance, element?: HTMLElement): void {
  throw new Error("@miragon/modeler-shell: applyAppearance is not implemented yet");
}

export interface AppearanceListenerOptions {
  /** The modes the modeler can show; the body-class fallback resolves against them. */
  themes: readonly Theme[];
}

/**
 * Listens for `AppearanceMessage`s on `window` and applies them. Until the first message arrives,
 * a `MutationObserver` on `<body>` applies the VS Code body classes as fallback (resolved against
 * `themes`); messages win from then on. Returns the disconnect function.
 */
export function connectAppearance(options: AppearanceListenerOptions): () => void {
  throw new Error("@miragon/modeler-shell: connectAppearance is not implemented yet");
}
