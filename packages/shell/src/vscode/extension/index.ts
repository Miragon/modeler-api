export type { ColorThemeLike, DisposableLike, VsCodeLike, WebviewPanelLike } from "./types.js";
export type { WebviewHtmlOptions } from "./html.js";
export { createNonce, renderWebviewHtml } from "./html.js";
export type { ThemeBridgeOptions } from "./theme-bridge.js";
export { connectThemeBridge, currentAppearance } from "./theme-bridge.js";
export { revealFileLabel } from "./reveal.js";
export type { AppearanceMessage } from "../protocol.js";
export { APPEARANCE_MESSAGE_TYPE, appearanceMessage, isAppearanceMessage } from "../protocol.js";
