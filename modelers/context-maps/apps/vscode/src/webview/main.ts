import "./zod-jitless.js";
import "@fontsource-variable/geist/wght.css";
import "@fontsource-variable/geist-mono/wght.css";
// The renderer's stylesheet (through its entry) brings the tokens, diagram-js.css and cd-canvas.css.
import {
  contextMapMenu,
  createCollaborativeModeler,
  createShortcutsDialog,
  createTitleDialog,
  isCmContext,
  isCmElement,
  renderLegend,
  READ_ONLY_CHANGED_EVENT,
  type CmReadOnly,
  type CollaborativeContextMapsModeler,
} from "@miragon/context-maps-renderer";
import { parseDocumentText, serializeDocumentText } from "@miragon/context-maps-schema-model";
import { serializeCml } from "@miragon/context-maps-cml";
import "@miragon/modeler-shell/shell.css";
import type { ShellHandle } from "@miragon/modeler-shell";
import { INVALID_STATUS_DELAY_MS } from "@miragon/modeler-shell/core";
import {
  connectDiagramJs,
  shellModule,
  type DiagramJsConnection,
} from "@miragon/modeler-shell/diagram-js";
import {
  mountVsCodeShell,
  persistView,
  readShellState,
  writeShellState,
} from "@miragon/modeler-shell/vscode/webview";
import type { ExportFormat, HostToWebview, WebviewCommand, WebviewToHost } from "../protocol.js";
import { WEBVIEW_THEMES } from "../themes.js";
import { blobToBase64, embedSvg, svgToEmbeddedPng } from "./io.js";

interface VsCodeApi {
  postMessage(message: WebviewToHost): void;
  getState(): unknown;
  setState(state: unknown): void;
}
declare const acquireVsCodeApi: () => VsCodeApi;

interface DiagramElement {
  id: string;
}
interface ElementRegistryLike {
  getAll(): DiagramElement[];
  get(id: string): DiagramElement | undefined;
}
interface SelectionLike {
  get(): DiagramElement[];
  select(elements: DiagramElement[] | null): void;
}
interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MAP_NAME = "context map";

const vscode = acquireVsCodeApi();
const storedShellState = readShellState(vscode);

// The diagram first: the map's keyboard listens on document and must run before the shell's key
// listener, and the Modeler builds its diagram lazily on the first get(). Undo and redo keys stay
// unbound: VS Code's document history owns them (guide §13.5). The webview runs the same
// collaborative-modeler contract as every other host, so its imports are silent and fitted.
const collaborative = createCollaborativeModeler({
  additionalModules: [shellModule],
  undoRedoKeys: false,
  freeArea: { insets: () => shell.fitInsets() },
});
const modeler = collaborative.diagram;
modeler.get("canvas");
const registry = modeler.get<ElementRegistryLike>("elementRegistry");
const selection = modeler.get<SelectionLike>("selection");
const canvasLock = modeler.get<CmReadOnly>("cmReadOnly");

const app = document.getElementById("app");
if (!app) throw new Error("The webview HTML has no #app root.");

const shell = mountVsCodeShell(app, {
  themes: WEBVIEW_THEMES,
  canvas: modeler.container,
  messages: { canvas: "Context map" },
  menu: contextMapMenu({
    exports: {
      png: { onSelect: () => void exportAs("png") },
      svg: { onSelect: () => void exportAs("svg") },
      json: { onSelect: () => void exportAs("json") },
      cml: { onSelect: () => void exportAs("cml") },
    },
    showKeyboardShortcuts: () => shortcutsDialog.open(),
    editTitle: () => titleDialog.open(),
  }),
  // The rows come after the mount, which hands out the chrome tooltip they explain themselves in.
  legend: {
    render: () => undefined,
    open: storedShellState.legendOpen,
    onToggle: (open) => writeShellState(vscode, { legendOpen: open }),
  },
  problems: { onActivate: () => post({ type: "showProblems" }) },
  emptyHint: { onInsertExample: () => post({ type: "insertExample" }) },
});
if (shell.legend) renderLegend(shell.legend.body, { tooltip: shell.tooltip });
const shortcutsDialog = createShortcutsDialog(shell);
// A title change is a canvas edit like any other: one command, posted to the document as one edit.
const titleDialog = createTitleDialog(shell, {
  title: () => modeler.getMeta()?.title ?? "",
  setTitle: (title) => modeler.setMeta({ title }),
});
// The lock disables "Map title…" in the menu; an open dialog would apply a title the file never gets.
modeler.on<{ readOnly?: boolean }>(READ_ONLY_CHANGED_EVENT, (event) => {
  if (event.readOnly) titleDialog.close();
});
modeler.on("diagram.destroy", () => {
  shortcutsDialog.destroy();
  titleDialog.destroy();
});

/** The tight bounds of the contexts (relationship lines run between them); no padding of its own. */
function contentBounds(): Box | undefined {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const element of registry.getAll()) {
    if (!isCmContext(element)) continue;
    const box = element as unknown as Box;
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }
  if (!Number.isFinite(minX)) return undefined;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// Cheap tests only: the shell asks on every content change.
const connection = connectDiagramJs(shell, modeler, {
  contentBounds,
  isEmpty: () => !registry.getAll().some(isCmElement),
});
const { viewport } = connection;
persistView(vscode, viewport);

// ---------------------------------------------------------------------------
// Two-way sync with the document
// ---------------------------------------------------------------------------

let lastText = "";
let initialized = false;

function post(message: WebviewToHost): void {
  vscode.postMessage(message);
}

/** The canonical text of `text`, or undefined when it is no map right now. */
function canonicalTextOf(text: string): string | undefined {
  const parsed = parseDocumentText(text);
  return parsed.ok ? serializeDocumentText(parsed.document) : undefined;
}

function selectedIds(): string[] {
  return selection.get().map((element) => element.id);
}

function reselect(ids: readonly string[]): void {
  const elements = ids
    .map((id) => registry.get(id))
    .filter((element): element is DiagramElement => element !== undefined);
  if (elements.length) selection.select(elements);
}

function showValidMap(): void {
  canvasLock.setReadOnly(false);
  shell.setReadOnly(false);
  shell.setStatus(null);
}

function showInvalidMap(): void {
  // Locked at once; the marks and the status box follow after 800ms without a valid import, so
  // typing in the text editor neither flickers nor re-announces the alert (guide §13.5).
  canvasLock.setReadOnly(true);
  shell.setReadOnly(true, { delayMs: INVALID_STATUS_DELAY_MS });
  shell.setStatus(
    { severity: "danger", text: shell.messages.invalidFile(MAP_NAME) },
    { delayMs: INVALID_STATUS_DELAY_MS },
  );
}

/**
 * Loads `text` into the modeler. The first import takes the stored view or fits; every later one
 * (a host undo, the text editor, Git) keeps viewbox and selection. An update that describes the
 * map the canvas already shows (only its formatting differs, e.g. `insertFinalNewline` on save) is
 * not re-imported at all.
 */
async function importText(text: string): Promise<void> {
  const first = !initialized;
  if (!first && canonicalTextOf(text) === collaborative.exportText()) {
    lastText = text;
    showValidMap();
    return;
  }
  const keep = first ? undefined : viewport.getViewbox();
  const selected = first ? [] : selectedIds();
  try {
    await collaborative.importText(text);
    lastText = text;
    showValidMap();
    if (keep) viewport.restore(keep);
    else if (first && storedShellState.view) viewport.setState(storedShellState.view);
    reselect(selected);
    viewport.afterImport();
  } catch {
    showInvalidMap();
  } finally {
    initialized = true;
  }
}

// Strictly serialized: init/update arrive as un-awaited messages, and two quick updates (several
// undos) must not import concurrently and finish in the wrong order. The PNG save waits for it too.
let importChain: Promise<void> = Promise.resolve();
function enqueueImport(text: string): Promise<void> {
  importChain = importChain
    .then(() => importText(text))
    .catch((error: unknown) => console.error("Context Maps import failed", error));
  return importChain;
}

/** Graphical change -> canonical JSON and (only on a real difference) report it to the host. */
function pushEdit(): void {
  // Before the first import the canvas does not show the document yet; read-only: it shows the
  // last valid map. Either way an edit would overwrite text the canvas never saw.
  if (!initialized || shell.isReadOnly()) return;
  const text = collaborative.exportText();
  if (text === lastText) return;
  lastText = text;
  post({ type: "edit", text });
}

collaborative.onContentChanged(pushEdit);

// ---------------------------------------------------------------------------
// Export (the webview rasterizes/serializes; the host shows the save dialog)
// ---------------------------------------------------------------------------

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The picture shows the map, not the current selection outlines. */
async function withoutSelection<T>(task: () => Promise<T> | T): Promise<T> {
  const ids = selectedIds();
  selection.select(null);
  try {
    return await task();
  } finally {
    reselect(ids);
  }
}

async function exportData(format: ExportFormat): Promise<string> {
  const text = collaborative.exportText();
  switch (format) {
    case "json":
      return text;
    case "cml":
      return serializeCml(modeler.exportDocument());
    case "svg":
      return embedSvg((await withoutSelection(() => modeler.saveSVG())).svg, text);
    case "png": {
      const { svg } = await withoutSelection(() => modeler.saveSVG());
      return blobToBase64(await svgToEmbeddedPng(svg, text));
    }
  }
}

async function exportAs(format: ExportFormat): Promise<void> {
  try {
    post({ type: "export", format, data: await exportData(format) });
  } catch (error) {
    post({
      type: "error",
      message: `Could not export the map as ${format.toUpperCase()}: ${messageOf(error)}`,
    });
  }
}

/**
 * PNG editor: the host requests the embedded PNG (save/backup). The queued imports finish first,
 * so a running init/update never rasterizes a half-imported map; an error reaches the host, which
 * aborts the save instead of writing a broken file.
 */
async function respondPng(id: number): Promise<void> {
  try {
    await importChain;
    post({ type: "pngResponse", id, data: await exportData("png") });
  } catch (error) {
    post({ type: "pngResponse", id, error: messageOf(error) });
  }
}

// ---------------------------------------------------------------------------
// Messages from the extension host
// ---------------------------------------------------------------------------

const COMMANDS: Readonly<Record<WebviewCommand, () => void>> = {
  fitView: () => viewport.fit(),
  exportPng: () => void exportAs("png"),
  exportSvg: () => void exportAs("svg"),
  exportJson: () => void exportAs("json"),
  exportCml: () => void exportAs("cml"),
};

function isHostMessage(data: unknown): data is HostToWebview {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as { type?: unknown }).type === "string"
  );
}

let firstImportSettled: () => void = () => undefined;
const ready = new Promise<void>((resolve) => (firstImportSettled = resolve));

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (!isHostMessage(event.data)) return;
  const message = event.data;
  switch (message.type) {
    case "init":
      void enqueueImport(message.text).then(firstImportSettled);
      break;
    case "update":
      void enqueueImport(message.text);
      break;
    case "problems":
      shell.setProblems({ count: message.count, errors: message.errors });
      break;
    case "command":
      // Only own entries: a name such as "constructor" must not reach Object.prototype.
      if (Object.hasOwn(COMMANDS, message.name)) COMMANDS[message.name]();
      break;
    case "requestPng":
      void respondPng(message.id);
      break;
  }
});

post({ type: "ready" });

/** For test pages: the mounted parts, and `ready` once the first `init` import settled. */
export const webview: {
  shell: ShellHandle;
  modeler: CollaborativeContextMapsModeler;
  connection: DiagramJsConnection;
  ready: Promise<void>;
} = { shell, modeler: collaborative, connection, ready };
