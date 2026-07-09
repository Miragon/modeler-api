import type { ModuleDeclaration } from "didi";
import CmLabelEditing from "./CmLabelEditing.js";

/** Inline label editing (double-click a team to rename). */
export const cmLabelEditingModule: ModuleDeclaration = {
  __init__: ["cmLabelEditing"],
  cmLabelEditing: ["type", CmLabelEditing],
};

export { default as CmLabelEditing } from "./CmLabelEditing.js";
