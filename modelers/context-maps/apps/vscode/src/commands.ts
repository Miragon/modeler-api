import * as vscode from "vscode";
import type { WebviewCommand } from "./protocol.js";

export const MAP_VIEW_TYPE = "contextMaps.editor";
export const PNG_VIEW_TYPE = "contextMaps.pngEditor";

export const WEBVIEW_COMMANDS: Readonly<Record<WebviewCommand, string>> = {
  fitView: "contextMaps.fitView",
  exportPng: "contextMaps.exportPng",
  exportSvg: "contextMaps.exportSvg",
  exportJson: "contextMaps.exportJson",
  exportCml: "contextMaps.exportCml",
};

export const NO_MAP_MESSAGE = "Open a Context Maps diagram in the diagram editor first.";

/** Text and diagram side by side (guide §13.5), from the editor title of either editor. */
export const OPEN_SOURCE_COMMAND = "contextMaps.openSource";
export const OPEN_DIAGRAM_COMMAND = "contextMaps.openDiagram";

/**
 * Editor title buttons pass the editor's resource; the Command Palette passes nothing, so the
 * caller falls back to the focused diagram or text editor.
 */
function resourceArgument(argument: unknown): vscode.Uri | undefined {
  return argument instanceof vscode.Uri ? argument : undefined;
}

export function registerSideBySideCommands(
  activeMapUri: () => vscode.Uri | undefined,
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand(OPEN_SOURCE_COMMAND, (argument?: unknown) => {
      const uri = resourceArgument(argument) ?? activeMapUri();
      if (!uri) return void vscode.window.showInformationMessage(NO_MAP_MESSAGE);
      return vscode.commands.executeCommand(
        "vscode.openWith",
        uri,
        "default",
        vscode.ViewColumn.Beside,
      );
    }),
    vscode.commands.registerCommand(OPEN_DIAGRAM_COMMAND, (argument?: unknown) => {
      const uri = resourceArgument(argument) ?? vscode.window.activeTextEditor?.document.uri;
      if (!uri) return undefined;
      return vscode.commands.executeCommand(
        "vscode.openWith",
        uri,
        MAP_VIEW_TYPE,
        vscode.ViewColumn.Beside,
      );
    }),
  ];
}

/**
 * The Command Palette commands run the same handlers as the webview menu (guide §13.5): the
 * command only forwards its name to the focused diagram. `runCommand` returns false when no
 * diagram editor is focused (a keybinding of the user's own can still invoke the command then).
 */
export function registerWebviewCommands(
  runCommand: (name: WebviewCommand) => boolean,
): vscode.Disposable[] {
  return (Object.keys(WEBVIEW_COMMANDS) as WebviewCommand[]).map((name) =>
    vscode.commands.registerCommand(WEBVIEW_COMMANDS[name], () => {
      if (!runCommand(name)) void vscode.window.showInformationMessage(NO_MAP_MESSAGE);
    }),
  );
}

/** Tracks which diagram webview has the focus, across the text and the PNG editor. */
export class ActivePanels {
  private active: vscode.WebviewPanel | undefined;
  private readonly documents = new WeakMap<vscode.WebviewPanel, vscode.Uri>();

  /** Follows `panel` until it is disposed. */
  track(panel: vscode.WebviewPanel, documentUri: vscode.Uri): vscode.Disposable {
    this.documents.set(panel, documentUri);
    if (panel.active) this.active = panel;
    const viewState = panel.onDidChangeViewState(() => {
      if (panel.active) this.active = panel;
      else if (this.active === panel) this.active = undefined;
    });
    return new vscode.Disposable(() => {
      viewState.dispose();
      if (this.active === panel) this.active = undefined;
    });
  }

  /** The document of the focused diagram, if a diagram editor has the focus. */
  activeDocumentUri(): vscode.Uri | undefined {
    return this.active ? this.documents.get(this.active) : undefined;
  }

  /** Forwards a Command Palette command to the focused diagram; false when none is focused. */
  runCommand(name: WebviewCommand): boolean {
    if (!this.active) return false;
    void this.active.webview.postMessage({ type: "command", name });
    return true;
  }
}
