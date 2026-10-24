import type { ModuleDeclaration } from "didi";
import { cmReadOnlyModule } from "../read-only/index.js";
import CmKeyboard from "./CmKeyboard.js";

/** Select all, undo/redo and delete-selection while the canvas has the focus. */
export const cmKeyboardModule: ModuleDeclaration = {
  __depends__: [cmReadOnlyModule],
  __init__: ["cmKeyboard"],
  cmKeyboard: ["type", CmKeyboard],
};

export { default as CmKeyboard } from "./CmKeyboard.js";
export type { CmKeyboardConfig } from "./CmKeyboard.js";
