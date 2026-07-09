import type { ModuleDeclaration } from "didi";
import CmModeling from "./CmModeling.js";
import CmLayouter from "../model/CmLayouter.js";

/**
 * High-level Context Maps mutations + command handlers. Also (re)binds the
 * cropping `layouter`: diagram-js' ModelingModule binds a default BaseLayouter,
 * and this module loads after it, so binding here wins and relationship lines
 * dock to the context box borders.
 */
export const cmModelingModule: ModuleDeclaration = {
  __init__: ["cmModeling"],
  cmModeling: ["type", CmModeling],
  layouter: ["type", CmLayouter],
};

export { default as CmModeling } from "./CmModeling.js";
