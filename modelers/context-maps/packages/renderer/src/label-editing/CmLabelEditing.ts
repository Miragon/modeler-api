/**
 * In-place editing via diagram-js-direct-editing (the bpmn.io mechanism):
 * double-click a context or relationship — or use the context pad's rename
 * action — and the name becomes editable directly inside the element, at the
 * spot and size it is rendered (Shift+Enter inserts a line break the renderer
 * preserves). The owning-team caption edits the same way: the pad's team
 * action (or a double-click on the caption) opens the box right over it.
 * Enter/blur commits through `cmModeling` (undoable), Escape cancels;
 * panning/zooming or starting a drag completes the edit. The edited text is
 * hidden behind an element marker while the box is open so nothing doubles up.
 */

import type Canvas from "diagram-js/lib/core/Canvas";
import type EventBus from "diagram-js/lib/core/EventBus";
import type { Element, ShapeLike } from "diagram-js/lib/model/Types";
import { CONTEXT_NAME_TOP, CONTEXT_TEAM_RESERVE, FONT } from "../draw/styles.js";
import { isCmContext, isCmElement, type CmContext, type CmElement } from "../model/di-types.js";
import type CmModeling from "../modeling/CmModeling.js";

type EditMode = "name" | "team";

/** Hide the rendered text being edited: `.cm-name` resp. `.cm-team` (CSS). */
const MARKERS: Record<EditMode, string> = {
  name: "cm-direct-editing",
  team: "cm-direct-editing-team",
};

/** Mirrors the renderer: label wrap inset (10px each side). */
const LABEL_INSET_X = 10;
/** The team caption band at the bottom of the box (renderer: centre at h-12). */
const TEAM_BAND_HEIGHT = 20;
const TEAM_BAND_BOTTOM_GAP = 2;

// The service surface of the (untyped, plain-JS) diagram-js-direct-editing
// package — typed locally so nothing untyped leaks into the published d.ts.
interface DirectEditingContext {
  bounds: { x: number; y: number; width: number; height: number };
  text: string;
  style?: Record<string, string | number>;
  options?: { centerVertically?: boolean; autoResize?: boolean; resizable?: boolean };
}

interface DirectEditingService {
  registerProvider(provider: {
    activate(element: Element): DirectEditingContext | undefined;
    update(element: Element, newText: string): void;
  }): void;
  activate(element: Element): boolean;
  isActive(element?: Element): boolean;
  cancel(): void;
  complete(): void;
}

export default class CmLabelEditing {
  static $inject = ["eventBus", "canvas", "directEditing", "cmModeling"];

  /** Which property the CURRENT activation edits (set right before activate). */
  private mode: EditMode = "name";
  private activeMarker?: { element: Element; marker: string };

  constructor(
    eventBus: EventBus,
    private readonly canvas: Canvas,
    private readonly directEditing: DirectEditingService,
    private readonly modeling: CmModeling,
  ) {
    // Registered as a plain object: the provider contract claims the method
    // name `activate` for context creation, while this service keeps
    // `activate(element)` as the public "start editing" API.
    directEditing.registerProvider({
      activate: (element) => this.activationContext(element),
      update: (element, newText) => this.commit(element, newText),
    });

    eventBus.on(
      "element.dblclick",
      (event: { element?: unknown; originalEvent?: { clientY?: number } }) => {
        const element = event.element;
        if (!isCmElement(element)) return;
        // A double-click on the team caption band edits the team, not the name.
        this.mode =
          isCmContext(element) && element.team && this.isInTeamBand(element, event.originalEvent)
            ? "team"
            : "name";
        directEditing.activate(element as Element);
      },
    );

    // The edit box is viewport-anchored — complete before the canvas moves
    // away underneath it (complete() is a no-op while inactive).
    eventBus.on(["canvas.viewbox.changing", "drag.init"], () => directEditing.complete());

    eventBus.on("directEditing.activate", (event: { active?: { element?: Element } }) => {
      const element = event.active?.element;
      if (!element) return;
      const marker = MARKERS[this.mode];
      canvas.addMarker(element as unknown as ShapeLike, marker);
      this.activeMarker = { element, marker };
    });
    eventBus.on(["directEditing.complete", "directEditing.cancel"], () => {
      const active = this.activeMarker;
      if (active) canvas.removeMarker(active.element as unknown as ShapeLike, active.marker);
      this.activeMarker = undefined;
    });
  }

  /** Start in-place editing of the element's name (context pad, hosts). */
  activate(element: CmElement): void {
    this.mode = "name";
    this.directEditing.activate(element as Element);
  }

  /** Start in-place editing of the owning-team caption at the box bottom. */
  activateTeam(context: CmContext): void {
    this.mode = "team";
    this.directEditing.activate(context as unknown as Element);
  }

  cancel(): void {
    this.directEditing.cancel();
  }

  private isInTeamBand(context: CmContext, originalEvent?: { clientY?: number }): boolean {
    if (typeof originalEvent?.clientY !== "number") return false;
    const zoom = this.canvas.zoom();
    const bbox = this.canvas.getAbsoluteBBox(context as unknown as ShapeLike);
    const containerTop = this.canvas.getContainer().getBoundingClientRect().top;
    const y = originalEvent.clientY - containerTop;
    return y >= bbox.y + bbox.height - (TEAM_BAND_HEIGHT + TEAM_BAND_BOTTOM_GAP) * zoom;
  }

  private activationContext(element: Element): DirectEditingContext | undefined {
    if (!isCmElement(element)) return undefined;
    if (this.mode === "team" && !isCmContext(element)) this.mode = "name";
    const zoom = this.canvas.zoom();
    const bbox = this.canvas.getAbsoluteBBox(element as unknown as ShapeLike);

    if (this.mode === "team") {
      const context = element as CmContext;
      // Right over the caption at the box bottom, in the caption's type size.
      return {
        bounds: {
          x: bbox.x + LABEL_INSET_X * zoom,
          y: bbox.y + bbox.height - (TEAM_BAND_HEIGHT + TEAM_BAND_BOTTOM_GAP) * zoom,
          width: bbox.width - 2 * LABEL_INSET_X * zoom,
          height: TEAM_BAND_HEIGHT * zoom,
        },
        text: context.team ?? "",
        style: {
          fontFamily: FONT.family,
          fontSize: `${FONT.small * zoom}px`,
          fontWeight: 400,
          lineHeight: 1.2,
          backgroundColor: "transparent",
          border: "1px dashed rgba(51, 93, 229, 0.65)",
          textAlign: "center",
        },
        options: { centerVertically: true },
      };
    }

    const style: Record<string, string | number> = {
      fontFamily: FONT.family,
      fontSize: `${FONT.label * zoom}px`,
      fontWeight: 650,
      lineHeight: 1.2,
      // In-place illusion: the element's own fill stays visible, a dashed
      // accent frame signals the edit state (the rendered name is hidden).
      backgroundColor: "transparent",
      border: "1px dashed rgba(51, 93, 229, 0.65)",
      textAlign: "center",
    };

    if (isCmContext(element)) {
      // The renderer anchors the name at the fixed top offset below the type
      // header — mirror that band exactly so the text does not jump. The 1px
      // dashed border (box-sizing: border-box) pushes the text down — offset
      // the box up by it.
      const reserve = element.team ? CONTEXT_TEAM_RESERVE * zoom : 0;
      return {
        bounds: {
          x: bbox.x + LABEL_INSET_X * zoom,
          y: bbox.y + CONTEXT_NAME_TOP * zoom - 1,
          width: bbox.width - 2 * LABEL_INSET_X * zoom,
          height: bbox.height - CONTEXT_NAME_TOP * zoom - reserve,
        },
        text: element.cmLabel ?? "",
        style,
      };
    }

    // Relationship: a compact box centred on the line (the canvas shows the
    // label only in the hover tooltip, so the box needs its own paper).
    const width = 160 * zoom;
    const height = 44 * zoom;
    return {
      bounds: {
        x: bbox.x + bbox.width / 2 - width / 2,
        y: bbox.y + bbox.height / 2 - height / 2,
        width,
        height,
      },
      text: (element as CmElement).cmLabel ?? "",
      style: { ...style, backgroundColor: "rgba(255, 255, 255, 0.95)" },
      options: { centerVertically: true },
    };
  }

  private commit(element: Element, newText: string): void {
    const value = newText.trim();
    // DirectEditing also calls update() on pure bounds jitter — don't push a
    // no-op command (an empty undo step) when nothing changed.
    if (this.mode === "team") {
      const context = element as unknown as CmContext;
      if (value === (context.team ?? "")) return;
      this.modeling.setTeam(context, value || undefined);
      return;
    }
    if (value === ((element as CmElement).cmLabel ?? "")) return;
    this.modeling.updateLabel(element as CmElement, value);
  }
}
