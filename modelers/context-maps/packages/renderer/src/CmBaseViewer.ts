/**
 * Shared lifecycle & DI bootstrap for every Context Maps viewer. Subclasses
 * only override `_getModules()`. The renderer
 * is framework-agnostic — mount it into any element (e.g. a VS Code webview).
 */

import Diagram from "diagram-js/lib/Diagram";
import type { ModuleDeclaration } from "didi";
import type Canvas from "diagram-js/lib/core/Canvas";
import type ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import type EventBus from "diagram-js/lib/core/EventBus";
import type { Root } from "diagram-js/lib/model/Types";
import type { CmDocument } from "@miragon/context-maps-schema-model";
import { saveSVG } from "./io/saveSvg.js";
import type CmImporter from "./io/CmImporter.js";
import type CmExporter from "./io/CmExporter.js";
import { ROOT_ID, type ImportWarning, type RootBusinessObject } from "./io/types.js";

export interface CmViewerOptions {
  /** Host element. When absent, a detached <div> is created (attach later). */
  container?: HTMLElement;
  width?: number | string;
  height?: number | string;
  /** Appended to the module list (extension point). */
  additionalModules?: ModuleDeclaration[];
}

export type EventCallback<T = unknown> = (event: T) => void;

type RootWithMeta = Root & { businessObject?: RootBusinessObject };

function sizeToCss(value: number | string): string {
  return typeof value === "number" ? `${value}px` : value;
}

export abstract class CmBaseViewer {
  protected abstract _getModules(): ModuleDeclaration[];

  private _diagram: Diagram | undefined;
  private readonly _container: HTMLElement;
  private readonly _options: CmViewerOptions;

  constructor(options: CmViewerOptions = {}) {
    this._options = options;
    this._container = this._createContainer(options);
  }

  private _createContainer(options: CmViewerOptions): HTMLElement {
    const container = options.container ?? document.createElement("div");
    container.classList.add("cm-djs-container");
    container.style.width = sizeToCss(options.width ?? "100%");
    container.style.height = sizeToCss(options.height ?? (options.container ? "100%" : "600px"));
    return container;
  }

  private _ensureDiagram(): Diagram {
    if (!this._diagram) {
      const modules = [...this._getModules(), ...(this._options.additionalModules ?? [])];
      this._diagram = new Diagram({ canvas: { container: this._container }, modules });
    }
    return this._diagram;
  }

  /** Resolve a diagram-js service from the didi injector. */
  get<T>(name: string): T {
    return this._ensureDiagram().get<T>(name);
  }

  on<T = unknown>(event: string, callback: EventCallback<T>, priority = 1000): void {
    this.get<EventBus>("eventBus").on(event, priority, callback as EventCallback);
  }

  off(event: string, callback: EventCallback): void {
    this.get<EventBus>("eventBus").off(event, callback);
  }

  /** Load a document into the canvas (replaces existing content). */
  importDocument(doc: CmDocument): { warnings: ImportWarning[] } {
    const diagram = this._ensureDiagram();
    const eventBus = diagram.get<EventBus>("eventBus");
    const importer = diagram.get<CmImporter>("cmImporter");
    importer.clear();
    const warnings = importer.import(doc);
    this._fit();
    eventBus.fire("import.done", { warnings });
    return { warnings };
  }

  /** Current canvas state as a canonical document. */
  exportDocument(): CmDocument {
    return this.get<CmExporter>("cmExporter").export();
  }

  /** Update diagram-level metadata (title / flow-of-change) on the root. */
  setMeta(partial: Partial<RootBusinessObject>): void {
    const canvas = this.get<Canvas>("canvas");
    let root: RootWithMeta | undefined;
    try {
      root = canvas.getRootElement() as RootWithMeta;
    } catch {
      return;
    }
    if (!root || root.id !== ROOT_ID) return;
    const current = root.businessObject ?? { title: "Untitled context map" };
    root.businessObject = { ...current, ...partial };
  }

  /** Read diagram-level metadata (title / flow-of-change) from the root. */
  getMeta(): RootBusinessObject | undefined {
    try {
      const root = this.get<Canvas>("canvas").getRootElement() as RootWithMeta;
      return root.businessObject;
    } catch {
      return undefined;
    }
  }

  /** Standalone, self-contained SVG snapshot. */
  saveSVG(): { svg: string } {
    return saveSVG(this.get<Canvas>("canvas"), this.get<ElementRegistry>("elementRegistry"));
  }

  /** Fit the content into the viewport, leaving room at the top for the palette. */
  private _fit(topInset = 84, pad = 56): void {
    const canvas = this.get<Canvas>("canvas");
    const registry = this.get<ElementRegistry>("elementRegistry");
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const el of registry.getAll()) {
      const e = el as { x?: number; y?: number; width?: number; height?: number };
      if (
        typeof e.x !== "number" ||
        typeof e.y !== "number" ||
        typeof e.width !== "number" ||
        typeof e.height !== "number"
      ) {
        continue;
      }
      minX = Math.min(minX, e.x);
      minY = Math.min(minY, e.y);
      maxX = Math.max(maxX, e.x + e.width);
      maxY = Math.max(maxY, e.y + e.height);
    }
    if (!Number.isFinite(minX)) return;

    const rect = this._container.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    const cw = Math.max(maxX - minX, 1);
    const ch = Math.max(maxY - minY, 1);
    if (!W || !H) {
      canvas.zoom("fit-viewport");
      return;
    }
    const s = Math.min((W - 2 * pad) / cw, (H - topInset - pad) / ch, 1.25);
    canvas.viewbox({
      x: minX + cw / 2 - W / 2 / s,
      y: minY - topInset / s,
      width: W / s,
      height: H / s,
    });
  }

  /** Attach the container into `target`. */
  attachTo(target: HTMLElement): void {
    target.appendChild(this._container);
    this.get<Canvas>("canvas").resized();
  }

  /** Detach the container from the DOM, preserving state. */
  detach(): void {
    this._container.remove();
  }

  clear(): void {
    this._ensureDiagram().clear();
  }

  destroy(): void {
    if (this._diagram) {
      this._diagram.destroy();
      this._diagram = undefined;
    }
    this._container.remove();
  }

  get container(): HTMLElement {
    return this._container;
  }
}
