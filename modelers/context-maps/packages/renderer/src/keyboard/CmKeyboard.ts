/**
 * Keyboard shortcuts: select all, undo / redo, delete-selection. Bound to the document so they
 * work without first clicking (focusing) the canvas, but only for keys aimed at the canvas: keys
 * from outside its container (a host's chrome) and keys someone closer to the target already
 * handled (`defaultPrevented`) are left alone, and typing inside form fields is never
 * intercepted. No container `tabindex`, so the canvas adds no tab stop of its own.
 */

import type Canvas from "diagram-js/lib/core/Canvas";
import type CommandStack from "diagram-js/lib/command/CommandStack";
import type ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import type EventBus from "diagram-js/lib/core/EventBus";
import type Selection from "diagram-js/lib/features/selection/Selection";
import type Modeling from "diagram-js/lib/features/modeling/Modeling";
import type { Element } from "diagram-js/lib/model/Types";
import { isCmElement } from "../model/di-types.js";
import type CmReadOnly from "../read-only/CmReadOnly.js";

export interface CmKeyboardConfig {
  /**
   * Bind Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z and Cmd/Ctrl+Y to the canvas command stack (default true).
   * A host that owns the history (the VS Code document) passes false, so the keys reach it.
   */
  undoRedoKeys?: boolean | undefined;
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  );
}

/**
 * A key aimed at the canvas: from inside its container, or with nothing focused at all. The
 * palette lives in the container too, but a key on a focused palette entry is the palette's: Delete
 * there must not remove the selected elements.
 */
function isCanvasTarget(target: EventTarget | null, container: HTMLElement): boolean {
  if (!(target instanceof Node)) return false;
  if (target instanceof Element && target.closest(".djs-palette")) return false;
  const ownerDocument = container.ownerDocument;
  return (
    container.contains(target) ||
    target === ownerDocument.body ||
    target === ownerDocument.documentElement
  );
}

export default class CmKeyboard {
  static $inject = [
    "config.cmKeyboard",
    "canvas",
    "commandStack",
    "selection",
    "modeling",
    "elementRegistry",
    "eventBus",
    "cmReadOnly",
  ];

  constructor(
    config: CmKeyboardConfig | undefined,
    canvas: Canvas,
    commandStack: CommandStack,
    selection: Selection,
    modeling: Modeling,
    elementRegistry: ElementRegistry,
    eventBus: EventBus,
    readOnly: Pick<CmReadOnly, "isReadOnly">,
  ) {
    const container = canvas.getContainer();
    const doc = container.ownerDocument ?? document;
    const undoRedoKeys = config?.undoRedoKeys ?? true;

    const onKeydown = (e: KeyboardEvent): void => {
      if (e.defaultPrevented) return;
      if (!isCanvasTarget(e.target, container)) return;
      if (isTypingTarget(e.target)) return;
      const cmd = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Select all reads the map, so it stays under the read-only lock; without it the host
      // (VS Code) would run its own Select All over the chrome's text.
      if (cmd && key === "a" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        selection.select(elementRegistry.filter((element) => isCmElement(element)) as Element[]);
        return;
      }
      if (readOnly.isReadOnly()) return;

      const isUndo = cmd && key === "z" && !e.shiftKey;
      const isRedo = (cmd && key === "z" && e.shiftKey) || (cmd && key === "y" && !e.shiftKey);
      if (isUndo || isRedo) {
        if (!undoRedoKeys) return;
        e.preventDefault();
        if (isUndo && commandStack.canUndo()) commandStack.undo();
        if (isRedo && commandStack.canRedo()) commandStack.redo();
      } else if (key === "delete" || key === "backspace") {
        const sel = selection.get() as Element[];
        if (sel.length) {
          e.preventDefault();
          modeling.removeElements([...sel]);
        }
      }
    };

    doc.addEventListener("keydown", onKeydown);
    eventBus.on("diagram.destroy", () => doc.removeEventListener("keydown", onKeydown));
  }
}
