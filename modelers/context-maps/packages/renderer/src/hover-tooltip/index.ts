import type { ModuleDeclaration } from "didi";
import CmHoverTooltip from "./CmHoverTooltip.js";

/** A fast tooltip with an element's own data (description, team, technology) on hover. */
export const cmHoverTooltipModule: ModuleDeclaration = {
  __init__: ["cmHoverTooltip"],
  cmHoverTooltip: ["type", CmHoverTooltip],
};

export { default as CmHoverTooltip, hoverTipFor } from "./CmHoverTooltip.js";
