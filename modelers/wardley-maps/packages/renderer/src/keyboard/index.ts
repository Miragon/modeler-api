import type { ModuleDeclaration } from "didi";
import WardleyKeyboard from "./WardleyKeyboard.js";

/** Undo/redo/delete and the single-key tools on the focused canvas. */
export const wardleyKeyboardModule: ModuleDeclaration = {
  __init__: ["wardleyKeyboard"],
  wardleyKeyboard: ["type", WardleyKeyboard],
};

export { default as WardleyKeyboard } from "./WardleyKeyboard.js";
