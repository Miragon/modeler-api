export type { VsCodeSmokeContext, VsCodeSmokeFixture, VsCodeSmokeOptions } from "./driver.js";
export { createFromPalette, runVsCodeSmoke } from "./driver.js";
export type { ExtensionManifest, PlatformKeys, UserSettingsOptions, VsCodeSmokePaths } from "./launch.js";
export {
  DEFAULT_WINDOW_SIZE,
  customEditorViewType,
  extensionIdOf,
  matchesFilenamePattern,
  platformKeys,
  vsCodeEnvironment,
  vsCodeLaunchArgs,
  vsCodeUserSettings,
} from "./launch.js";
export type {
  ChromePresence,
  VsCodeSmokeResult,
  VsCodeSmokeStep,
  VsCodeSmokeThemeResult,
  VsCodeSmokeTimings,
} from "./result.js";
export { VSCODE_SMOKE_STEPS, formatVsCodeSmoke, screenshotFileName } from "./result.js";
export type { VsCodeColorTheme } from "./themes.js";
export {
  VSCODE_COLOR_THEMES,
  expectedWebviewAppearance,
  webviewBodyClasses,
  workbenchThemeClass,
} from "./themes.js";
