import * as vscode from "vscode";
import type { ExportFormat } from "./protocol.js";

/** Save dialog filter + on-disk extension for each export format. */
const EXPORT_SPECS: Record<ExportFormat, { label: string; extension: string; filter: string[] }> = {
  svg: { label: "SVG", extension: "svg", filter: ["svg"] },
  png: { label: "PNG", extension: "png", filter: ["png"] },
  cml: { label: "CML", extension: "cml", filter: ["cml"] },
  json: { label: "JSON", extension: "cm.json", filter: ["cm.json", "json"] },
};

/**
 * Export to disk via a save dialog. Image formats (SVG/PNG) embed the scene (native JSON document) so
 * they can be reopened as a diagram; the text formats (CML/JSON) write the exchanged representation
 * directly. Shared by the text and PNG editor (hence generic over the source URI rather than a
 * document type). PNG data arrives Base64-encoded, everything else as UTF-8 text.
 */
export async function exportToFile(
  sourceUri: vscode.Uri | undefined,
  format: ExportFormat,
  data: string,
): Promise<void> {
  const spec = EXPORT_SPECS[format];
  const options: vscode.SaveDialogOptions = { filters: { [`${spec.label} file`]: spec.filter } };
  const defaultUri = exportDefaultUri(sourceUri, spec.extension);
  if (defaultUri) options.defaultUri = defaultUri;
  const target = await vscode.window.showSaveDialog(options);
  if (!target) return;

  const bytes =
    format === "png" ? new Uint8Array(Buffer.from(data, "base64")) : new TextEncoder().encode(data);
  await vscode.workspace.fs.writeFile(target, bytes);

  const action = await vscode.window.showInformationMessage(
    `Context Maps diagram exported as ${spec.label}.`,
    "Reveal",
  );
  if (action === "Reveal") void vscode.commands.executeCommand("revealFileInOS", target);
}

/** `<name>.<extension>` next to the source file (if no file: in the first workspace folder). */
function exportDefaultUri(
  sourceUri: vscode.Uri | undefined,
  extension: string,
): vscode.Uri | undefined {
  if (sourceUri && sourceUri.scheme === "file") {
    // Strip double extensions like `.cm.png` / `.cm.json` too, so `topology.cm.png` -> `topology.svg`.
    const path = sourceUri.path.replace(/(\.cm)?\.[^./]+$/i, "");
    return sourceUri.with({ path: `${path}.${extension}` });
  }
  const folder = vscode.workspace.workspaceFolders?.[0];
  return folder ? vscode.Uri.joinPath(folder.uri, `context-map.${extension}`) : undefined;
}
