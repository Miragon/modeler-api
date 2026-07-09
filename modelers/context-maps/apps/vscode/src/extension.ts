import * as vscode from "vscode";
import {
  serializeDocument,
  SAMPLE_DOCUMENT,
  DOCUMENT_VERSION,
} from "@miragon/context-maps-schema-model";
import type { CmDocument } from "@miragon/context-maps-schema-model";
import { CmEditorProvider } from "./CmEditorProvider.js";
import { CmPngEditorProvider } from "./CmPngEditorProvider.js";

const EMPTY_DOCUMENT: CmDocument = {
  version: DOCUMENT_VERSION,
  title: "New context map",
  contexts: [],
  relationships: [],
};

const EMPTY_MAP = serializeDocument(EMPTY_DOCUMENT, true) + "\n";

/** The bundled example diagram (identical to the demo webapp), as a starting point. */
const EXAMPLE_MAP = serializeDocument(SAMPLE_DOCUMENT, true) + "\n";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    CmEditorProvider.register(context),
    CmPngEditorProvider.register(context),
    vscode.commands.registerCommand("contextMaps.newDiagram", () => createMap(EMPTY_MAP)),
    vscode.commands.registerCommand("contextMaps.newFromExample", () => createMap(EXAMPLE_MAP)),
    vscode.commands.registerCommand("contextMaps.newPngDiagram", () => createPngMap()),
  );
}

export function deactivate(): void {
  /* nothing to do — all resources are tied to context.subscriptions */
}

/** A real file URI rather than an untitled doc is most robust for CustomTextEditor. */
async function createMap(initial: string): Promise<void> {
  const options: vscode.SaveDialogOptions = {
    title: "New Context Maps Diagram",
    saveLabel: "Create diagram",
    filters: { "Context Maps": ["cm", "cm.json"] },
  };
  const defaultUri = defaultMapUri();
  if (defaultUri) options.defaultUri = defaultUri;

  const target = await vscode.window.showSaveDialog(options);
  if (!target) return;

  await vscode.workspace.fs.writeFile(target, new TextEncoder().encode(initial));
  await vscode.commands.executeCommand("vscode.openWith", target, CmEditorProvider.viewType);
}

function defaultMapUri(): vscode.Uri | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  return folder ? vscode.Uri.joinPath(folder.uri, "context-map.cm") : undefined;
}

/**
 * Creates a new, embedded PNG diagram (`*.cm.png`) and opens it in the PNG editor. The file starts
 * as a 0-byte placeholder (rendering only works in the webview) and is immediately "dirty": a Cmd+S
 * materializes the rendered PNG with the embedded document.
 */
async function createPngMap(): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  const options: vscode.SaveDialogOptions = {
    title: "New Context Maps Diagram (embedded PNG)",
    saveLabel: "Create diagram",
    filters: { "Context Maps (PNG)": ["png"] },
  };
  if (folder) options.defaultUri = vscode.Uri.joinPath(folder.uri, "context-map.cm.png");

  const chosen = await vscode.window.showSaveDialog(options);
  if (!chosen) return;

  // Ensure the editor will actually claim the file (it only binds *.cm.png/*.cm.png).
  const target = /\.cm\.png$/i.test(chosen.path)
    ? chosen
    : chosen.with({ path: `${chosen.path.replace(/\.png$/i, "")}.cm.png` });

  await vscode.workspace.fs.writeFile(target, new Uint8Array());
  await vscode.commands.executeCommand("vscode.openWith", target, CmPngEditorProvider.viewType);
}
