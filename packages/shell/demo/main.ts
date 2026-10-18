import "../fixtures/tokens/cd-tokens.generated.css";
import "diagram-js/assets/diagram-js.css";
import "../src/shell.css";
import "./demo.css";

import {
  appearanceAttributes,
  mountShell,
  resolveAppearance,
  type Appearance,
  type MenuGroups,
  type ShellHandle,
  type ShellHost,
  type Theme,
} from "../src/index.js";
import { connectDiagramJs, type DiagramJsConnection } from "../src/diagram-js.js";
import { applyAppearance, mountVsCodeShell } from "../src/vscode-webview.js";
import { addSampleShapes, createDemoDiagram, demoContentBounds } from "./demo-diagram.js";

/**
 * The demo page the shell's own e2e suite drives. Query parameters:
 * - `host`: `ide` (default, a simulated VS Code webview), `web` or `embedded` (a foreign page);
 * - `themes`: the modes the demo modeler declares, comma-separated (default `light`);
 * - `theme`, `kontrast`: what the host requests (default `light`, none);
 * - `empty`: start without content; `legend`, `inspector`: mount those slots;
 * - `problems=<count>:<errors>`, `status=danger|warning`: show pill and status box at start.
 */
const params = new URLSearchParams(location.search);
const host = (params.get("host") ?? "ide") as ShellHost;
const themes = (params.get("themes") ?? "light").split(",") as Theme[];
const requested: Appearance = {
  theme: (params.get("theme") ?? "light") as Theme,
  ...(params.get("kontrast") === "hoch" ? { kontrast: "hoch" as const } : {}),
};

const calls: string[] = [];
let snap = true;
let level = "big-picture";

const menu: MenuGroups = {
  model: [
    {
      kind: "radio",
      id: "level",
      label: "Level",
      options: [
        { value: "big-picture", label: "Big picture" },
        { value: "process", label: "Process modelling" },
        { value: "design", label: "Software design" },
      ],
      value: () => level,
      onSelect: (value) => {
        level = value;
        calls.push(`level:${value}`);
      },
    },
    {
      kind: "checkbox",
      id: "snap",
      label: "Snap to grid",
      checked: () => snap,
      onToggle: (checked) => {
        snap = checked;
        calls.push(`snap:${checked}`);
      },
    },
  ],
  export: [
    {
      kind: "action",
      id: "export-png",
      label: "Export as PNG",
      icon: "file-image",
      onSelect: () => calls.push("export-png"),
    },
    {
      kind: "action",
      id: "export-svg",
      label: "Export as SVG",
      icon: "file-code-corner",
      onSelect: () => calls.push("export-svg"),
    },
  ],
  help: [
    {
      kind: "dialog",
      id: "shortcuts",
      label: "Keyboard shortcuts…",
      icon: "keyboard",
      onSelect: () => calls.push("shortcuts"),
    },
  ],
};

function hostElement(): HTMLElement {
  const app = document.getElementById("app");
  if (!app) throw new Error("demo: #app is missing");
  if (host !== "embedded") return app;
  // a foreign page: its own language and layout, the modeler in a sized box
  document.documentElement.classList.remove("cd-shell-document");
  document.documentElement.lang = "de";
  app.classList.add("demo-foreign-page");
  const box = document.createElement("div");
  box.className = "demo-embedded-host";
  app.append(box);
  return box;
}

const root = hostElement();
if (host === "ide") applyAppearance(resolveAppearance(requested, themes));
if (host === "web") {
  for (const [name, value] of Object.entries(appearanceAttributes(resolveAppearance(requested, themes)))) {
    document.documentElement.setAttribute(name, value);
  }
}

// the diagram first, so document keydown listeners of a modeler would precede the shell's
const canvasElement = document.createElement("div");
const diagram = createDemoDiagram(canvasElement);

const options = {
  canvas: canvasElement,
  lang: "en",
  menu,
  problems: { onActivate: () => calls.push("show-problems") },
  emptyHint: { onInsertExample: () => insertExample() },
  ...(params.has("legend")
    ? {
        legend: {
          render(body: HTMLElement) {
            body.innerHTML = `<div class="cd-shell-legend-row"><span class="cd-shell-legend-preview demo-legend-box"></span><span>Box</span></div>`;
          },
          onToggle: (open: boolean) => calls.push(`legend:${open}`),
        },
      }
    : {}),
  ...(params.has("inspector") ? { inspector: { label: "Properties" } } : {}),
};

const shell: ShellHandle =
  host === "ide" ? mountVsCodeShell(root, { ...options, themes }) : mountShell(root, { ...options, host });

const connection: DiagramJsConnection = connectDiagramJs(shell, diagram, {
  contentBounds: () => demoContentBounds(diagram),
});

function insertExample(): void {
  calls.push("insert-example");
  addSampleShapes(diagram);
  shell.setEmptyHint(false);
  connection.viewport.afterImport();
}

if (params.has("empty")) {
  shell.setEmptyHint(true);
} else {
  addSampleShapes(diagram);
  connection.viewport.afterImport();
}

const problems = params.get("problems");
if (problems) {
  const [count = 0, errors = 0] = problems.split(":").map(Number);
  shell.setProblems({ count, errors });
}
const status = params.get("status");
if (status === "danger" || status === "warning") {
  shell.setStatus({ severity: status, text: shell.messages.invalidFile("demo diagram") });
}

let destroyed = false;

const demo = {
  ready: true,
  host,
  themes,
  requested,
  calls,
  shell,
  connection,
  diagram,
  destroy(): void {
    if (destroyed) return;
    destroyed = true;
    connection.destroy();
    diagram.destroy();
    shell.destroy();
  },
};

declare global {
  interface Window {
    __demo?: typeof demo;
  }
}
window.__demo = demo;
