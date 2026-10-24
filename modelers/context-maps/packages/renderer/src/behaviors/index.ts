import type { ModuleDeclaration } from "didi";
import CmFlatModelBehavior from "./CmFlatModelBehavior.js";
import CmDragBehavior from "./CmDragBehavior.js";
import CmClickSelectionBehavior from "./CmClickSelectionBehavior.js";

/** Editing behaviors: keep the model flat (no nesting), drag-state CSS marker. */
export const cmBehaviorsModule: ModuleDeclaration = {
  __init__: ["cmFlatModelBehavior", "cmDragBehavior", "cmClickSelectionBehavior"],
  cmFlatModelBehavior: ["type", CmFlatModelBehavior],
  cmDragBehavior: ["type", CmDragBehavior],
  cmClickSelectionBehavior: ["type", CmClickSelectionBehavior],
};

export { default as CmFlatModelBehavior } from "./CmFlatModelBehavior.js";
export { default as CmDragBehavior } from "./CmDragBehavior.js";
export { default as CmClickSelectionBehavior } from "./CmClickSelectionBehavior.js";
