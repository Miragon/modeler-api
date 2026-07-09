/**
 * @miragon/context-maps-renderer — a framework-agnostic diagram-js modeler for
 * DDD context maps (bounded contexts + context-mapping relationships).
 * React-free and DOM-dependent, so it can be embedded as-is in any host (the web
 * app, or later a VS Code webview). Depends only on diagram-js and
 * @miragon/context-maps-schema-model.
 */

import "./assets/context-maps.css";

// Viewer layering
export { Viewer } from "./Viewer.js";
export { NavigatedViewer } from "./NavigatedViewer.js";
export { Modeler } from "./Modeler.js";
export { CmBaseViewer } from "./CmBaseViewer.js";
export type { CmViewerOptions, EventCallback } from "./CmBaseViewer.js";

// Modules (for additionalModules / extension) + their services
export { cmModelModule, CmElementFactory } from "./model/index.js";
export { cmDrawModule, ContextMapsRenderer } from "./draw/index.js";
export { ioModule, CmImporter, CmExporter, saveSVG, ROOT_ID } from "./io/index.js";
export { cmModelingModule, CmModeling } from "./modeling/index.js";
export { cmRulesModule, CmRules } from "./rules/index.js";
export { cmBehaviorsModule, CmFlatModelBehavior } from "./behaviors/index.js";
export { cmPaletteModule, CmPaletteProvider } from "./palette/index.js";
export { cmConnectHandlesModule, CmConnectHandles } from "./connect-handles/index.js";
export { cmLabelEditingModule, CmLabelEditing } from "./label-editing/index.js";
export { cmKeyboardModule, CmKeyboard } from "./keyboard/index.js";
export { cmZOrderModule, CmZOrder } from "./zorder/index.js";

// Runtime types & guards
export { isCmElement, isCmContext, isCmRelationship } from "./model/di-types.js";
export type { CmElement, CmContext, CmRelationship } from "./model/di-types.js";
export type { ImportWarning, RootBusinessObject } from "./io/index.js";

// Palette glyphs — reusable for host chrome (e.g. the legend).
export { contextIconSvg, relationshipIconSvg } from "./draw/palette-icons.js";
