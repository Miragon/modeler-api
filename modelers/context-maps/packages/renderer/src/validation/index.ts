import type { ModuleDeclaration } from "didi";
import OverlaysModule from "diagram-js/lib/features/overlays";
import CmValidationMarkers from "./CmValidationMarkers.js";

/** Live semantic-rule markers (warning triangles with tooltips) on the canvas. */
export const cmValidationModule: ModuleDeclaration = {
  __depends__: [OverlaysModule],
  __init__: ["cmValidationMarkers"],
  cmValidationMarkers: ["type", CmValidationMarkers],
};

export { default as CmValidationMarkers } from "./CmValidationMarkers.js";
