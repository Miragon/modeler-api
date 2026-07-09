import type { ModuleDeclaration } from "didi";
import CmFlatModelBehavior from "./CmFlatModelBehavior.js";
import CmDragBehavior from "./CmDragBehavior.js";

/** Editing behaviors: keep the model flat (no nesting), drag-state CSS marker. */
export const cmBehaviorsModule: ModuleDeclaration = {
  __init__: ["cmFlatModelBehavior", "cmDragBehavior"],
  cmFlatModelBehavior: ["type", CmFlatModelBehavior],
  cmDragBehavior: ["type", CmDragBehavior],
};

export { default as CmFlatModelBehavior } from "./CmFlatModelBehavior.js";
export { default as CmDragBehavior } from "./CmDragBehavior.js";
