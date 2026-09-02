import type { ModuleDeclaration } from "didi";
import PaletteModule from "diagram-js/lib/features/palette";
import CreateModule from "diagram-js/lib/features/create";
import ConnectModule from "diagram-js/lib/features/connect";
import LassoToolModule from "diagram-js/lib/features/lasso-tool";
import CmPaletteProvider from "./CmPaletteProvider.js";

/** Tool palette: lasso tool + drag-to-create contexts. */
export const cmPaletteModule: ModuleDeclaration = {
  __depends__: [PaletteModule, CreateModule, ConnectModule, LassoToolModule],
  __init__: ["cmPaletteProvider"],
  cmPaletteProvider: ["type", CmPaletteProvider],
};

export { default as CmPaletteProvider } from "./CmPaletteProvider.js";
