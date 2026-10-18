import type { Appearance } from "../core/index.js";

/** The one message the theme bridge posts to the webview. */
export const APPEARANCE_MESSAGE_TYPE = "modelerShell.appearance";

export interface AppearanceMessage {
  type: typeof APPEARANCE_MESSAGE_TYPE;
  /** Already resolved against the modeler's themes. */
  appearance: Appearance;
}

export function appearanceMessage(appearance: Appearance): AppearanceMessage {
  throw new Error("@miragon/modeler-shell: appearanceMessage is not implemented yet");
}

/** Type guard for `MessageEvent.data` in the webview. */
export function isAppearanceMessage(value: unknown): value is AppearanceMessage {
  throw new Error("@miragon/modeler-shell: isAppearanceMessage is not implemented yet");
}
