import type { ModuleDeclaration } from "didi";
import { vcDrawModule } from "../draw/index.js";
import VcBounds from "./VcBounds.js";

/** Content bounds of the diagram (import fit, SVG export, a host's fit), labels included. */
export const vcBoundsModule: ModuleDeclaration = {
  __depends__: [vcDrawModule],
  vcBounds: ["type", VcBounds],
};

export { default as VcBounds } from "./VcBounds.js";
