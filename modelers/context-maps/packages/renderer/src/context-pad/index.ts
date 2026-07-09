import type { ModuleDeclaration } from "didi";
import ContextPadModule from "diagram-js/lib/features/context-pad";
import ConnectModule from "diagram-js/lib/features/connect";
import CmContextPadProvider from "./CmContextPadProvider.js";

/** Per-element context actions (connect, rename, delete). */
export const cmContextPadModule: ModuleDeclaration = {
  __depends__: [ContextPadModule, ConnectModule],
  __init__: ["cmContextPadProvider"],
  cmContextPadProvider: ["type", CmContextPadProvider],
};

export { default as CmContextPadProvider } from "./CmContextPadProvider.js";
