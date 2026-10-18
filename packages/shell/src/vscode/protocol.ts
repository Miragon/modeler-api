import type { Appearance } from "../core/index.js";

/** The one message the theme bridge posts to the webview. */
export const APPEARANCE_MESSAGE_TYPE = "modelerShell.appearance";

export interface AppearanceMessage {
  type: typeof APPEARANCE_MESSAGE_TYPE;
  /** Already resolved against the modeler's themes. */
  appearance: Appearance;
}

/** A plain, JSON-safe message (no `kontrast: undefined` key). */
export function appearanceMessage(appearance: Appearance): AppearanceMessage {
  return {
    type: APPEARANCE_MESSAGE_TYPE,
    appearance: appearance.kontrast
      ? { theme: appearance.theme, kontrast: appearance.kontrast }
      : { theme: appearance.theme },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Type guard for `MessageEvent.data` in the webview. */
export function isAppearanceMessage(value: unknown): value is AppearanceMessage {
  if (!isRecord(value) || value.type !== APPEARANCE_MESSAGE_TYPE || !isRecord(value.appearance)) return false;
  const { theme, kontrast } = value.appearance;
  return (theme === "light" || theme === "dark") && (kontrast === undefined || kontrast === "hoch");
}
