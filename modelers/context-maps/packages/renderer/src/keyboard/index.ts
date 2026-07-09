import type { ModuleDeclaration } from "didi";
import CmKeyboard from "./CmKeyboard.js";

/** Undo/redo + delete-selection on the canvas container. */
export const cmKeyboardModule: ModuleDeclaration = {
  __init__: ["cmKeyboard"],
  cmKeyboard: ["type", CmKeyboard],
};

export { default as CmKeyboard } from "./CmKeyboard.js";
