import "../fixtures/tokens/cd-tokens.generated.css";
import "@fontsource-variable/geist/wght.css";
import "@fontsource-variable/geist-mono/wght.css";
import "diagram-js/assets/diagram-js.css";
import "../src/shell.css";
import "./demo.css";

import kometUrl from "../fixtures/brand/miragon-komet-blau.svg?url";
import tokens from "../fixtures/tokens/cd-tokens.generated.json";
import { mountShell, problemSummary, type ShellHandle, type Theme } from "../src/index.js";
import { connectDiagramJs, type DiagramJsConnection } from "../src/diagram-js.js";
import { addSampleShapes, createDemoDiagram, demoContentBounds, type DemoFlaws } from "./demo-diagram.js";

/**
 * The web-app variant of the demo (`/web.html`): every 0.2 web-host option of `mountShell`, the
 * way a Miragon web app passes them. Query parameters: `themes` (default `light`), `empty` (start
 * on the start screen), `legend`. The page records what the chrome asked it to do in
 * `window.__webDemo.calls`.
 *
 * TODO(kit-demo): the head mode script (`webHeadMarkup` through the Vite config), the harness
 * globals the web cases need (`__webDemo.toast`, `setEmptyState`, problems with items), a drop
 * fixture handler, and switching the conformance suite's web host to this page.
 */
const params = new URLSearchParams(location.search);
const themes = (params.get("themes") ?? "light").split(",") as Theme[];
const calls: string[] = [];

const app = document.getElementById("app");
if (!app) throw new Error("web demo: #app is missing");

const flaws: DemoFlaws = { noKeyboardCreate: false, canvasUnlocked: false, noSelectAll: false };
const canvasElement = document.createElement("div");
const diagram = createDemoDiagram(canvasElement, {
  flaws,
  isReadOnly: () => shell.isReadOnly(),
  freeRectCenter: () => connection.viewport.freeRectCenter(),
});

function openSample(): void {
  connection.viewport.newDocument();
  addSampleShapes(diagram);
  connection.viewport.afterImport();
}

const shell: ShellHandle = mountShell(app, {
  host: "web",
  canvas: canvasElement,
  lang: "en",
  themes,
  messages: { canvas: "Demo diagram" },
  primary: { onSelect: () => void shell.toast({ status: "success", text: "Link copied" }) },
  legal: { links: [{ label: "GitHub", href: "https://github.com/Miragon/modeler-api" }] },
  file: {
    newDiagram: { onSelect: () => calls.push("new-diagram") },
    open: { onSelect: () => calls.push("open"), shortcut: "⌘O" },
    showExample: { onSelect: () => openSample() },
  },
  appearance: {
    themeColors: { light: tokens.fest["--cd-blau"], dark: tokens.dunkel["--cd-ui-grund"] },
  },
  menu: {
    export: [
      {
        kind: "action",
        id: "export-png",
        label: "Export as PNG",
        icon: "file-image",
        onSelect: () => calls.push("export-png"),
      },
    ],
  },
  problems: { onSelectItem: (item) => calls.push(`select:${item.elementId ?? ""}`) },
  emptyState: {
    title: "Demo Modeler",
    text: "Start a new diagram, or explore the example.",
    komet: kometUrl,
    onNewDiagram: () => calls.push("new-diagram"),
    onShowExample: () => openSample(),
  },
  dropZone: {
    accept: [".demo", ".json", "application/json"],
    onDrop: (files) => calls.push(`drop:${files.map((file) => file.name).join(",")}`),
  },
});

const connection: DiagramJsConnection = connectDiagramJs(shell, diagram, {
  contentBounds: () => demoContentBounds(diagram),
});

if (params.has("empty")) {
  shell.setEmptyState(true);
} else {
  addSampleShapes(diagram);
}
connection.viewport.afterImport();
shell.setProblems(
  problemSummary([{ severity: "warning", message: "A box without a name.", location: "Box 2" }]),
);

const webDemo = { ready: true, calls, shell, connection, diagram, flaws };

declare global {
  interface Window {
    __webDemo?: typeof webDemo;
  }
}
window.__webDemo = webDemo;
