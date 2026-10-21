import * as vscode from 'vscode';
import { EditorProvider } from './EditorProvider.js';
import { EMPTY_DIAGRAM } from './examples.js';

/** The save dialog's file type: a computed key, so the name may hold a space. */
const FILE_TYPE = '__DISPLAY_NAME__';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    EditorProvider.register(context),
    vscode.commands.registerCommand('__NOTATION__.newDiagram', () => createDiagram()),
  );
}

export function deactivate(): void {
  // Everything is tied to context.subscriptions.
}

/** A real file, not an untitled document: a custom text editor is most robust on a file URI. */
async function createDiagram(): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  const target = await vscode.window.showSaveDialog({
    title: 'New __DISPLAY_NAME__ Diagram',
    saveLabel: 'Create diagram',
    filters: { [FILE_TYPE]: ['__EXT__'] },
    ...(folder ? { defaultUri: vscode.Uri.joinPath(folder.uri, 'untitled.__EXT__') } : {}),
  });
  if (!target) return;
  await vscode.workspace.fs.writeFile(target, new TextEncoder().encode(EMPTY_DIAGRAM));
  await vscode.commands.executeCommand('vscode.openWith', target, EditorProvider.viewType);
}
