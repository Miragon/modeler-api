import type { ModuleDeclaration } from "didi";
import CmImporter from "./CmImporter.js";
import CmExporter from "./CmExporter.js";

/** Document <-> diagram-js bridge (import / export). */
export const ioModule: ModuleDeclaration = {
  cmImporter: ["type", CmImporter],
  cmExporter: ["type", CmExporter],
};

export { default as CmImporter } from "./CmImporter.js";
export { default as CmExporter } from "./CmExporter.js";
export { saveSVG } from "./saveSvg.js";
export { ROOT_ID } from "./types.js";
export type { ImportWarning, RootBusinessObject } from "./types.js";
