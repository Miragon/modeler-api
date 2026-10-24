import type { ModuleDeclaration } from "didi";
import ConnectModule from "diagram-js/lib/features/connect";
import ConnectionPreviewModule from "diagram-js/lib/features/connection-preview";
import ContextPadModule from "diagram-js/lib/features/context-pad";
import TtContextPadPlacement from "./TtContextPadPlacement.js";
import TtContextPadProvider from "./TtContextPadProvider.js";

/** Per-element context actions (rename, annotate, attach, delete), kept inside the free area. */
export const ttContextPadModule: ModuleDeclaration = {
  __depends__: [ContextPadModule, ConnectModule, ConnectionPreviewModule],
  __init__: ["ttContextPadProvider", "ttContextPadPlacement"],
  ttContextPadProvider: ["type", TtContextPadProvider],
  ttContextPadPlacement: ["type", TtContextPadPlacement],
};

export { default as TtContextPadProvider } from "./TtContextPadProvider.js";
