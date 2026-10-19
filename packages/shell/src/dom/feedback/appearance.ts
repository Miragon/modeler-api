import type { AppearanceChoice, Theme } from "../../core/index.js";
import type { AppearanceHandle, WebAppearanceOptions } from "../types.js";

export interface WebAppearanceContext {
  ownerDocument: Document;
  themes: readonly Theme[];
  /** Required when `themes` includes `"dark"`; read only then. */
  options: WebAppearanceOptions | undefined;
}

export interface WebAppearanceController extends AppearanceHandle {
  /** Stops following `prefers-contrast` and other tabs' `storage` events; leaves `<html>` as it is. */
  destroy(): void;
}

/**
 * The web host's mode at runtime (guide §13.3), after the head script (`webModeScript`) set it
 * before the first paint. Always: mirrors `(prefers-contrast: more)` changes as
 * `data-cd-kontrast="hoch"` on `<html>`. With `"dark"` in `themes` (throws without `options`):
 * `choice()` reads `APPEARANCE_STORAGE_KEY` through `parseAppearanceChoice` (blocked storage reads
 * `"system"`), `setChoice` writes it (`"system"` removes it) and applies `documentMode` on
 * `<html data-cd-theme>`, `<meta name="color-scheme">` and both `theme-color` metas in one task,
 * with `cd-shell-no-transition` on `<html>` until a nested `requestAnimationFrame`; a `storage`
 * event for the key from another tab applies the same way. Light-only: `choice()` is `"system"`,
 * `setChoice` does nothing.
 */
export function connectWebAppearance(context: WebAppearanceContext): WebAppearanceController {
  // TODO(feedback): the behaviour above (the throw for a dark-capable modeler without options first).
  void context;
  let choice: AppearanceChoice = "system";
  return {
    choice: () => choice,
    setChoice(next) {
      choice = next;
    },
    destroy() {},
  };
}
