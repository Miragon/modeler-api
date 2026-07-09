import type { ModuleDeclaration } from "didi";
import RulesModule from "diagram-js/lib/features/rules";
import CmRules from "./CmRules.js";

/** Context Maps editing rules (connect, move, create, resize). */
export const cmRulesModule: ModuleDeclaration = {
  __depends__: [RulesModule],
  __init__: ["cmRules"],
  cmRules: ["type", CmRules],
};

export { default as CmRules } from "./CmRules.js";
