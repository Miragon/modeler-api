import type { ModuleDeclaration } from "didi";
import CroppingConnectionDocking from "diagram-js/lib/layout/CroppingConnectionDocking";
import CmElementFactory from "./CmElementFactory.js";
import CmDiagramElementFactory from "./CmDiagramElementFactory.js";

/**
 * Element factory with Context Maps defaults, plus the cropping docking so
 * relationship lines dock to the context box borders. The layouter itself is
 * bound in the modeling module (see there) because diagram-js' ModelingModule
 * binds a default `layouter` and loads after this one. The stock
 * `elementFactory` is replaced so every element gets a collision-free id
 * (see CmDiagramElementFactory).
 */
export const cmModelModule: ModuleDeclaration = {
  elementFactory: ["type", CmDiagramElementFactory],
  cmElementFactory: ["type", CmElementFactory],
  connectionDocking: ["type", CroppingConnectionDocking],
};

export { default as CmElementFactory } from "./CmElementFactory.js";
export { default as CmDiagramElementFactory } from "./CmDiagramElementFactory.js";
export { default as CmLayouter } from "./CmLayouter.js";
export * from "./di-types.js";
