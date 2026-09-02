import type { ModuleDeclaration } from "didi";
import DirectEditingModule from "diagram-js-direct-editing";
import { cmModelingModule } from "../modeling/index.js";
import CmLabelEditing from "./CmLabelEditing.js";

/** In-place name editing (double-click / context pad), bpmn.io style. */
export const cmLabelEditingModule: ModuleDeclaration = {
  __depends__: [DirectEditingModule, cmModelingModule],
  __init__: ["cmLabelEditing"],
  cmLabelEditing: ["type", CmLabelEditing],
};

export { default as CmLabelEditing } from "./CmLabelEditing.js";
