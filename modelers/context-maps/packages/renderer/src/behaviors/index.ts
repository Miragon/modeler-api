import type { ModuleDeclaration } from "didi";
import CmFlatModelBehavior from "./CmFlatModelBehavior.js";

/** Editing behaviors that keep the Context Maps model flat (no nesting). */
export const cmBehaviorsModule: ModuleDeclaration = {
  __init__: ["cmFlatModelBehavior"],
  cmFlatModelBehavior: ["type", CmFlatModelBehavior],
};

export { default as CmFlatModelBehavior } from "./CmFlatModelBehavior.js";
