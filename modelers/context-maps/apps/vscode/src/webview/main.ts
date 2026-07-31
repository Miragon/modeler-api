// Pulls the renderer CSS (incl. diagram-js.css) into the bundle via the renderer's index.
import { Modeler } from "@miragon/context-maps-renderer";
import {
  SAMPLE_DOCUMENT,
  parseDocument,
  serializeDocument,
} from "@miragon/context-maps-schema-model";
import type { CmDocument } from "@miragon/context-maps-schema-model";
import "./style.css";
import { embedSvg, svgToEmbeddedPng, blobToBase64 } from "./io.js";
import type { HostToWebview, WebviewToHost } from "../protocol.js";

interface VsCodeApi {
  postMessage(msg: WebviewToHost): void;
  getState(): unknown;
  setState(state: unknown): void;
}
declare const acquireVsCodeApi: () => VsCodeApi;
const vscode = acquireVsCodeApi();

const container = document.getElementById("canvas");
const toolbar = document.getElementById("toolbar");
if (!container || !toolbar) throw new Error("Webview layout incomplete (#canvas/#toolbar).");

const modeler = new Modeler({ container });
// Debug handle (like the webapp). Harmless in the sandboxed webview, helpful for diagnostics/tests.
(globalThis as Record<string, unknown>).__cmModeler = modeler;

// ---------------------------------------------------------------------------
// Two-way sync with the document (native JSON is the source of truth)
// ---------------------------------------------------------------------------

let lastText = ""; // text last reconciled with the host
let importing = false; // suppresses the edit echo during import
let importFailed = false; // the last import (e.g. externally typed text) was unparsable
let initialized = false; // first init done -> preserve zoom/viewport from then on

// Serialize imports STRICTLY: init/update arrive as (un-awaited) messages; without chaining, two
// quick updates (e.g. several undos) could import concurrently and finish in the wrong order. The
// PNG save (respondPng) also hooks onto this chain, so a half-imported state is never rasterized.
let importChain: Promise<void> = Promise.resolve();
function enqueueImport(text: string, fit: boolean): Promise<void> {
  importChain = importChain.then(() => importText(text, fit)).catch(() => {});
  return importChain;
}

/** Parse the document text; throws a descriptive error on invalid JSON or a schema violation. */
function parse(text: string): CmDocument {
  const value = text.trim() === "" ? {} : JSON.parse(text);
  const result = parseDocument(value);
  if (!result.ok) throw new Error(result.error);
  return result.document;
}

/** Canonical, comparable JSON of the current canvas state. */
function currentText(): string {
  return serializeDocument(modeler.exportDocument(), true);
}

/**
 * Loads `text` into the modeler. `fit=true` (first load) fits the diagram; `fit=false` (external or
 * echo-missed change) PRESERVES the current zoom/viewport — otherwise every change mirrored back by
 * the host (e.g. an `insertFinalNewline` appended on save) would reset the zoom. If the incoming
 * `update` describes the same diagram as the current state, it is not re-imported at all.
 */
async function importText(text: string, fit: boolean): Promise<void> {
  let doc: CmDocument;
  try {
    doc = parse(text);
  } catch (err) {
    // Parse error: the canvas keeps showing the last good diagram. Block pushEdit so a graphical
    // action doesn't overwrite the (just externally typed) unparsable text — until a successful
    // re-import (valid 'update') restores a known state.
    importFailed = true;
    vscode.postMessage({
      type: "error",
      message: `Could not parse this Context Maps file: ${(err as Error).message}`,
    });
    return;
  }

  if (!fit && initialized && serializeDocument(doc, true) === currentText()) {
    lastText = text;
    importFailed = false;
    return;
  }

  importing = true;
  const prevView = fit ? undefined : currentViewbox();
  try {
    modeler.importDocument(doc);
    lastText = text;
    importFailed = false;
    if (fit) fitView();
    else if (prevView) restoreViewbox(prevView);
  } finally {
    importing = false;
    initialized = true;
  }
  syncWelcome();
}

/** Graphical change -> serialize JSON and (only on a real difference) report it to the host. */
function pushEdit(): void {
  if (importing || importFailed) return;
  const text = currentText();
  if (text === lastText) return;
  lastText = text;
  vscode.postMessage({ type: "edit", text });
}

modeler.on("commandStack.changed", () => {
  pushEdit();
  syncWelcome();
});

window.addEventListener("message", (event: MessageEvent<HostToWebview>) => {
  const msg = event.data;
  if (msg.type === "init") void enqueueImport(msg.text, true);
  else if (msg.type === "update") void enqueueImport(msg.text, false);
  else if (msg.type === "requestPng") void respondPng(msg.id);
});

/**
 * PNG editor: the host requests the finished, embedded PNG (save/backup). We rasterize the current
 * state and send back Base64 — errors are reported as `error` so the host can cleanly abort the save
 * instead of writing a corrupt file. First wait for all imports queued up to this point so a
 * currently running init/update doesn't rasterize a half-imported state into the PNG.
 */
async function respondPng(id: number): Promise<void> {
  try {
    await importChain;
    deselect();
    const { svg } = modeler.saveSVG();
    const blob = await svgToEmbeddedPng(svg, currentText());
    vscode.postMessage({ type: "pngResponse", id, data: await blobToBase64(blob) });
  } catch (err) {
    vscode.postMessage({ type: "pngResponse", id, error: (err as Error).message });
  }
}

// ---------------------------------------------------------------------------
// Viewport helpers
// ---------------------------------------------------------------------------

interface Canvas {
  viewbox(box?: ViewBox): ViewBox;
  zoom(mode: string): void;
}
type ViewBox = { x: number; y: number; width: number; height: number };

function fitView(): void {
  try {
    modeler.get<Canvas>("canvas").zoom("fit-viewport");
  } catch {
    /* no canvas yet -> ignore */
  }
}

function currentViewbox(): ViewBox | undefined {
  try {
    const vb = modeler.get<Canvas>("canvas").viewbox();
    return { x: vb.x, y: vb.y, width: vb.width, height: vb.height };
  } catch {
    return undefined;
  }
}

function restoreViewbox(box: ViewBox): void {
  try {
    modeler.get<Canvas>("canvas").viewbox(box);
  } catch {
    /* no canvas yet -> ignore */
  }
}

function deselect(): void {
  modeler.get<{ select: (e: unknown) => void }>("selection").select(null);
}

// ---------------------------------------------------------------------------
// Menu (collapsed hamburger top right, Excalidraw style). NO undo/redo — VS Code handles that via
// Ctrl/Cmd+Z out of the box (the modeler's keyboard service is bound within the webview canvas).
// ---------------------------------------------------------------------------

function setMenuOpen(open: boolean): void {
  dropdown.hidden = !open;
  menuBtn.setAttribute("aria-expanded", String(open));
}

function menuItem(label: string, onClick: () => void): HTMLButtonElement {
  const item = document.createElement("button");
  item.type = "button";
  item.className = "menu-item";
  item.setAttribute("role", "menuitem");
  item.textContent = label;
  item.addEventListener("click", () => {
    setMenuOpen(false);
    onClick();
  });
  return item;
}

function menuSep(): HTMLDivElement {
  const sep = document.createElement("div");
  sep.className = "menu-sep";
  sep.setAttribute("role", "separator");
  return sep;
}

const menuBtn = document.createElement("button");
menuBtn.type = "button";
menuBtn.className = "menu-btn";
menuBtn.title = "Menu";
menuBtn.setAttribute("aria-label", "Menu");
menuBtn.setAttribute("aria-haspopup", "true");
menuBtn.setAttribute("aria-expanded", "false");
menuBtn.textContent = "☰";

const dropdown = document.createElement("div");
dropdown.className = "menu-dropdown";
dropdown.setAttribute("role", "menu");
dropdown.hidden = true;

dropdown.append(
  menuItem("Fit to view", fitView),
  menuSep(),
  menuItem("Export · SVG", exportSvg),
  menuItem("Export · PNG", exportPng),
);

toolbar.append(menuBtn, dropdown);

menuBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  setMenuOpen(dropdown.hidden === true);
});
document.addEventListener("click", (e) => {
  if (!(e.target as Element | null)?.closest("#toolbar")) setMenuOpen(false);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") setMenuOpen(false);
});

// ---------------------------------------------------------------------------
// Export (the webview rasterizes/serializes; the host shows the save dialog)
// ---------------------------------------------------------------------------

function exportSvg(): void {
  deselect();
  try {
    const { svg } = modeler.saveSVG();
    vscode.postMessage({ type: "export", format: "svg", data: embedSvg(svg, currentText()) });
  } catch (err) {
    vscode.postMessage({ type: "error", message: `SVG export failed: ${(err as Error).message}` });
  }
}

async function exportPng(): Promise<void> {
  deselect();
  try {
    const { svg } = modeler.saveSVG();
    const blob = await svgToEmbeddedPng(svg, currentText());
    vscode.postMessage({ type: "export", format: "png", data: await blobToBase64(blob) });
  } catch (err) {
    vscode.postMessage({ type: "error", message: `PNG export failed: ${(err as Error).message}` });
  }
}

// ---------------------------------------------------------------------------
// Empty-state welcome card. Shown while the opened file describes an empty
// diagram (fresh .cm file); mirrors the webapp's EmptyState. "New diagram"
// dismisses the card (the blank canvas IS the new diagram — the file already
// exists); "Show example" imports the bundled context map as a regular,
// undoable edit of the file.
// ---------------------------------------------------------------------------

/** The Miragon app mark (favicon.svg), inlined — the webview bundles no image assets. */
const WELCOME_MARK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-hidden="true" width="60" height="60">' +
  '<rect width="512" height="512" rx="112" fill="#335DE5" />' +
  '<path fill="#00E676" transform="translate(63 196) scale(1.34)" d="M0,89.63l220.2-14.78c11.65-.78,23.38-2.66,33.31-5.14s22.92-8.94,29.16-19.41c3.65-6.12,5.09-13.73,5.38-18.91,.27-4.94-.99-10.2-2.54-13.33-2.76-5.55-6.11-8.42-8.55-10.26-2.45-1.84-7.55-5.77-18.08-7.35-10.53-1.58-29.62,1.2-44.31,5.84C199.87,10.92,0,89.63,0,89.63Z" />' +
  "</svg>";

let welcomeDismissed = false;

function welcomeButton(label: string, primary: boolean, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = primary ? "welcome-btn welcome-btn--primary" : "welcome-btn";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

const welcome = document.createElement("div");
welcome.className = "welcome";
welcome.hidden = true;

const welcomeCard = document.createElement("div");
welcomeCard.className = "welcome-card";
welcomeCard.setAttribute("role", "region");
welcomeCard.setAttribute("aria-label", "Empty canvas");

const welcomeMark = document.createElement("div");
welcomeMark.className = "welcome-mark";
welcomeMark.innerHTML = WELCOME_MARK_SVG;

const welcomeTitle = document.createElement("h2");
welcomeTitle.className = "welcome-title";
welcomeTitle.textContent = "Context Maps";

const welcomeText = document.createElement("p");
welcomeText.className = "welcome-text";
welcomeText.textContent = "Start a new diagram, or open the example.";

const welcomeActions = document.createElement("div");
welcomeActions.className = "welcome-actions";
welcomeActions.append(
  welcomeButton("New diagram", true, () => {
    welcomeDismissed = true;
    syncWelcome();
  }),
  welcomeButton("Show example", false, () => {
    modeler.importDocument(SAMPLE_DOCUMENT);
    fitView();
    // importDocument bypasses the command stack — report the edit explicitly.
    pushEdit();
    syncWelcome();
  }),
);

welcomeCard.append(welcomeMark, welcomeTitle, welcomeText, welcomeActions);
welcome.append(welcomeCard);
document.getElementById("app")?.append(welcome);

function syncWelcome(): void {
  const doc = modeler.exportDocument();
  const empty = doc.contexts.length === 0 && doc.relationships.length === 0;
  welcome.hidden = !empty || welcomeDismissed || importFailed;
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

vscode.postMessage({ type: "ready" });
