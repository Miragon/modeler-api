import type { Theme } from "@miragon/modeler-shell/core";

/**
 * The Miragon modelers switch to dark together (guide §13.3); until then Context Maps has no dark
 * canvas, so the webview stays light in every VS Code theme instead of a half-dark chrome.
 */
export const WEBVIEW_THEMES: readonly Theme[] = ["light"];
