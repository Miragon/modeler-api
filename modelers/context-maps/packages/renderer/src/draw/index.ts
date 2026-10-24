import type { ModuleDeclaration } from "didi";
import ContextMapsRenderer from "./ContextMapsRenderer.js";

/** SVG rendering of all Context Maps element types (BaseRenderer, priority 1500). */
export const cmDrawModule: ModuleDeclaration = {
  __init__: ["cmRenderer"],
  cmRenderer: ["type", ContextMapsRenderer],
};

export { default as ContextMapsRenderer } from "./ContextMapsRenderer.js";
