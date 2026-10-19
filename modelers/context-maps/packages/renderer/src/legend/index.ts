import type { ModuleDeclaration } from "didi";
import CmLegend from "./CmLegend.js";

/**
 * The legend as a card on the canvas, for hosts without the Miragon modeler shell; with the shell,
 * render `renderLegend` into its legend instead.
 */
export const cmLegendModule: ModuleDeclaration = {
  __init__: ["cmLegend"],
  cmLegend: ["type", CmLegend],
};

export { default as CmLegend } from "./CmLegend.js";
export { legendGroups, renderLegend } from "./legendContent.js";
export type {
  LegendGroup,
  LegendRenderOptions,
  LegendRow,
  LegendTooltip,
} from "./legendContent.js";
