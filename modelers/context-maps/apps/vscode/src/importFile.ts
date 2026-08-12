import * as vscode from "vscode";

/**
 * Open a file picker for importing a diagram into the current editor and read the chosen file as
 * text. The webview then parses it (native JSON `.cm`/`.cm.json`, or Context Mapper `.cml`) and
 * imports it as a normal, undoable edit. Returns `undefined` when the user cancels.
 */
export async function pickImportFile(): Promise<{ name: string; text: string } | undefined> {
  const picked = await vscode.window.showOpenDialog({
    canSelectMany: false,
    openLabel: "Import",
    filters: { "Context Maps": ["cm", "json", "cml"] },
  });
  const uri = picked?.[0];
  if (!uri) return undefined;
  const bytes = await vscode.workspace.fs.readFile(uri);
  const name = uri.path.split("/").pop() ?? "";
  return { name, text: new TextDecoder().decode(bytes) };
}
