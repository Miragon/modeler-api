import type { ModuleDeclaration } from "didi";
import CmLegend from "./CmLegend.js";

export const cmLegendModule: ModuleDeclaration = {
  __init__: ["cmLegend"],
  cmLegend: ["type", CmLegend],
};

export { default as CmLegend } from "./CmLegend.js";
