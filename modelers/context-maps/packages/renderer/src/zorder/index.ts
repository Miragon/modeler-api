import type { ModuleDeclaration } from "didi";
import CmZOrder from "./CmZOrder.js";

/** Keeps the fixed stacking order (interactions on top, base teams at the back). */
export const cmZOrderModule: ModuleDeclaration = {
  __init__: ["cmZOrder"],
  cmZOrder: ["type", CmZOrder],
};

export { default as CmZOrder } from "./CmZOrder.js";
