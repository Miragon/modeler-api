import type { ModuleDeclaration } from "didi";
import PaletteModule from "diagram-js/lib/features/palette";
import CreateModule from "diagram-js/lib/features/create";
import ConnectModule from "diagram-js/lib/features/connect";
import GlobalConnectModule from "diagram-js/lib/features/global-connect";
import CmPaletteProvider from "./CmPaletteProvider.js";

/** Tool palette: drag-to-create contexts, connect-tool for relationships. */
export const cmPaletteModule: ModuleDeclaration = {
  __depends__: [PaletteModule, CreateModule, ConnectModule, GlobalConnectModule],
  __init__: ["cmPaletteProvider"],
  cmPaletteProvider: ["type", CmPaletteProvider],
};

export { default as CmPaletteProvider } from "./CmPaletteProvider.js";
