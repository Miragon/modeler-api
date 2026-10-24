/**
 * Keeps the selected element (with its context pad) clear of the inspector panel that edits it,
 * by gliding the canvas out from under the side panel or the bottom sheet.
 */

import { useEffect, useRef, type RefObject } from "react";
import type { Modeler } from "@miragon/team-topologies-renderer";
import type Canvas from "diagram-js/lib/core/Canvas";
import type Dragging from "diagram-js/lib/features/dragging/Dragging";
import type Selection from "diagram-js/lib/features/selection/Selection";
import type { Connection, Element as DiagramElement } from "diagram-js/lib/model/Types";
import type { Point } from "diagram-js/lib/util/Types";

/*
 * The glide aims at the free area the renderer keeps the context pad inside: the shell's fit insets
 * with the panel open (guide §5.9). Glided only as far as the panel, the pad would end in the
 * margin beside it and flip to the left of its element, away from the room the glide just made.
 */
/** `--cd-shell-einpassen-seite`: from the container's sides and from the side panel. */
const FREE_AREA_SIDE = 24;
/** `--cd-shell-einpassen-oben-schmal`: up to 760px the palette takes the second row. */
const NARROW_FREE_AREA_TOP = 140;
/** Above the bottom sheet: the fit inset is its top edge plus 12. */
const SHEET_GAP = 12;
/**
 * The glide stops this far inside the free area: diagram-js places the pad with the zoom rounded to
 * three decimals, and a pad a fraction of a pixel past the edge would flip.
 */
const ROUNDING_SLACK = 1;
/** diagram-js places the context pad this many diagram units to the right of the element. */
const CONTEXT_PAD_MARGIN = 8;
const CONTEXT_PAD_FALLBACK_WIDTH = 40;
const LABEL_EDITOR_SELECTOR = "textarea.tt-label-editor";
/** Matches --cd-motion-base. */
const PAN_DURATION_MS = 250;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * What the panel keeps clear, in diagram units: one element, or the bounds of a multi-selection
 * (whose context pad diagram-js places beside those bounds). The id says when it is a new target.
 */
export interface SelectionArea {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Pans by a screen-pixel delta, gliding unless the user asked for reduced motion. */
function glideCanvas(canvas: Canvas, dx: number, dy: number): () => void {
  if (prefersReducedMotion()) {
    canvas.scroll({ dx, dy });
    return () => undefined;
  }
  const start = performance.now();
  let moved = { x: 0, y: 0 };
  let frame = 0;
  const step = (now: number) => {
    const progress = Math.min(1, (now - start) / PAN_DURATION_MS);
    const eased = 1 - Math.pow(1 - progress, 3);
    const next = { x: dx * eased, y: dy * eased };
    canvas.scroll({ dx: next.x - moved.x, dy: next.y - moved.y });
    moved = next;
    if (progress < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

/** The shift that moves [start, end] inside [min, max]; when it can't fit, the start stays visible. */
export function shiftInto(start: number, end: number, min: number, max: number): number {
  if (end > max) return Math.max(max - end, min - start);
  if (start < min) return Math.min(min - start, max - end);
  return 0;
}

interface ScreenBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function graphicsBox(canvas: Canvas, elements: DiagramElement[]): ScreenBox | undefined {
  let box: ScreenBox | undefined;
  for (const element of elements) {
    const graphics = canvas.getGraphics(element.id) as SVGElement | undefined;
    if (!graphics) continue;
    const { left, top, right, bottom } = graphics.getBoundingClientRect();
    box = box
      ? {
          left: Math.min(box.left, left),
          top: Math.min(box.top, top),
          right: Math.max(box.right, right),
          bottom: Math.max(box.bottom, bottom),
        }
      : { left, top, right, bottom };
  }
  return box;
}

/**
 * The selection with its context pad on screen, the pad where diagram-js puts it
 * (`ContextPad#_getPosition`): beside the box of the selected graphics, which includes the
 * selection outline, top-aligned; a connection's pad at its last waypoint.
 */
function selectionWithPad(
  canvas: Canvas,
  area: SelectionArea,
  selected: DiagramElement[],
): ScreenBox {
  const container = canvas.getContainer().getBoundingClientRect();
  const viewbox = canvas.viewbox();
  const scale = viewbox.scale;
  const toScreenX = (x: number) => container.left + (x - viewbox.x) * scale;
  const toScreenY = (y: number) => container.top + (y - viewbox.y) * scale;
  const pad = canvas.getContainer().querySelector<HTMLElement>(".djs-context-pad");
  const padWidth = pad?.offsetWidth || CONTEXT_PAD_FALLBACK_WIDTH;
  const padHeight = pad?.offsetHeight ?? 0;
  const gap = CONTEXT_PAD_MARGIN * scale;

  const box = graphicsBox(canvas, selected) ?? {
    left: toScreenX(area.x),
    top: toScreenY(area.y),
    right: toScreenX(area.x + area.width),
    bottom: toScreenY(area.y + area.height),
  };
  const waypoints: Point[] | undefined =
    selected.length === 1 ? (selected[0] as Partial<Connection>).waypoints : undefined;
  const endPoint = waypoints?.at(-1);
  const padLeft = endPoint ? toScreenX(endPoint.x) + gap : box.right + gap;
  const padTop = endPoint ? toScreenY(endPoint.y) : box.top;
  return {
    left: Math.min(box.left, padLeft),
    top: Math.min(box.top, padTop),
    right: Math.max(box.right, padLeft + padWidth),
    bottom: Math.max(box.bottom, padTop + padHeight),
  };
}

/**
 * The screen-pixel pan that moves the element and its context pad out from under the panel: to the
 * left of the side panel, or into the strip between the palette and the bottom sheet (which also
 * brings a context pad back from beyond the right edge of a phone screen).
 */
function panOutFromUnder(
  canvas: Canvas,
  area: SelectionArea,
  selected: DiagramElement[],
  panel: HTMLElement,
) {
  const container = canvas.getContainer().getBoundingClientRect();
  const panelRect = restingBox(panel);
  const { left, top, right, bottom } = selectionWithPad(canvas, area, selected);
  const freeLeft = container.left + FREE_AREA_SIDE;

  const isBottomSheet = panelRect.width > container.width * 0.6;
  if (isBottomSheet) {
    const freeRight = container.right - FREE_AREA_SIDE;
    const freeTop = container.top + NARROW_FREE_AREA_TOP;
    const freeBottom = panelRect.top - SHEET_GAP;
    return {
      dx: shiftInto(left, right, freeLeft + ROUNDING_SLACK, freeRight - ROUNDING_SLACK),
      dy: shiftInto(top, bottom, freeTop + ROUNDING_SLACK, freeBottom - ROUNDING_SLACK),
    };
  }

  const freeRight = panelRect.left - FREE_AREA_SIDE;
  const reachesPanel =
    right > freeRight && left < panelRect.right && bottom > panelRect.top && top < panelRect.bottom;
  if (!reachesPanel) return { dx: 0, dy: 0 };
  const dx = shiftInto(left, right, freeLeft + ROUNDING_SLACK, freeRight - ROUNDING_SLACK);
  return { dx: Math.min(0, dx), dy: 0 };
}

/** The panel's box once its entrance animation, a translation (guide §5.11), has ended. */
function restingBox(panel: HTMLElement): DOMRect {
  const box = panel.getBoundingClientRect();
  const transform = getComputedStyle(panel).transform;
  if (!transform || transform === "none" || typeof DOMMatrixReadOnly === "undefined") return box;
  const { m41: translateX, m42: translateY } = new DOMMatrixReadOnly(transform);
  return new DOMRect(box.x - translateX, box.y - translateY, box.width, box.height);
}

function whenRemoved(node: Element, callback: () => void): () => void {
  const parent = node.parentNode;
  if (!parent) {
    callback();
    return () => undefined;
  }
  const observer = new MutationObserver(() => {
    if (node.isConnected) return;
    observer.disconnect();
    callback();
  });
  observer.observe(parent, { childList: true });
  return () => observer.disconnect();
}

/**
 * Keeps the selected element clear of the panel that edits it. It waits until the pointer is
 * released, so a press that starts a drag never moves the canvas under the cursor.
 */
export function useKeepSelectionVisible(
  modeler: Modeler,
  element: SelectionArea | null,
  panelRef: RefObject<HTMLElement | null>,
) {
  const pointerDown = useRef(false);

  useEffect(() => {
    const press = () => (pointerDown.current = true);
    const release = () => (pointerDown.current = false);
    window.addEventListener("pointerdown", press, true);
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
    return () => {
      window.removeEventListener("pointerdown", press, true);
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", release, true);
    };
  }, []);

  const elementId = element?.id;
  useEffect(() => {
    if (!element) return;
    let frame = 0;
    let stopGlide: () => void = () => undefined;
    let stopWaiting: () => void = () => undefined;

    const panIfCovered = () => {
      frame = requestAnimationFrame(() => {
        const panel = panelRef.current;
        if (!panel || modeler.get<Dragging>("dragging").context()) return;
        const canvas = modeler.get<Canvas>("canvas");
        // Any pan commits an open label editor, so the pan waits until typing is done.
        const labelEditor = canvas.getContainer().querySelector(LABEL_EDITOR_SELECTOR);
        if (labelEditor) {
          stopWaiting = whenRemoved(labelEditor, panIfCovered);
          return;
        }
        const selected = modeler.get<Selection>("selection").get();
        const { dx, dy } = panOutFromUnder(canvas, element, selected, panel);
        if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) stopGlide = glideCanvas(canvas, dx, dy);
      });
    };
    const interrupt = () => stopGlide();

    if (pointerDown.current) window.addEventListener("pointerup", panIfCovered, { once: true });
    else panIfCovered();
    window.addEventListener("pointerdown", interrupt, true);
    window.addEventListener("wheel", interrupt, { capture: true, passive: true });

    return () => {
      cancelAnimationFrame(frame);
      stopGlide();
      stopWaiting();
      window.removeEventListener("pointerup", panIfCovered);
      window.removeEventListener("pointerdown", interrupt, true);
      window.removeEventListener("wheel", interrupt, true);
    };
    // Re-running for every new object of the same target (each model revision) would re-pan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeler, elementId, panelRef]);
}
