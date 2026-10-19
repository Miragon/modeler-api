import type { ShellMessages, ToastRequest } from "../../core/index.js";
import { createElement } from "../element.js";
import type { DropZoneOptions, ToastHandle } from "../types.js";

/** The drop zone as the root shows it: `data-drop="over"` or `"forbidden"` while a file drag is on the page. */
export type DropZoneState = "over" | "forbidden" | null;

export interface DropZoneContext {
  ownerDocument: Document;
  /** Where the overlay goes: the shell's layer (40, guide §5.13). */
  layer: HTMLElement;
  messages: ShellMessages;
  lang: string;
  options: DropZoneOptions;
  /** A modal dialog is open in the document (the shell's dialog test). */
  modalOpen(): boolean;
  /** For the default `onReject`. */
  toast(request: ToastRequest): ToastHandle;
  /** Writes the root's `data-drop`. */
  setState(state: DropZoneState): void;
}

export interface DropZoneController {
  /** The overlay `<div data-chrome="drop-zone" aria-hidden="true">`. */
  readonly element: HTMLElement;
  state(): DropZoneState;
  destroy(): void;
}

/**
 * The page-wide drop zone of the web app (guide §9). Listens on the window (`dragenter`,
 * `dragover`, `dragleave`, `drop`; outermost pair counted) for drags carrying files only, so
 * palette drags and text drags into the label editor stay alone; `dragVerdict` decides the state.
 * Drag-over: overlay `inset: 12px`, fill `--cd-ui-hover`, 2px dashed `--cd-ui-interaktion`, radius
 * `lg`, chip `messages.dropFile` centred on `--cd-ui-flaeche-hoch` (13px/600, radius `md`,
 * `shadow-2`), `dropEffect = "copy"`. Forbidden: fill `--cd-ui-danger-flaeche`, dashed
 * `--cd-ui-danger`, chip `messages.dropForbidden(reason)`, `dropEffect = "none"` (cursor
 * `not-allowed`). Every file drag is `preventDefault`-ed, so the browser never navigates to the
 * file. A drop: files through `acceptsFile` → `onDrop(accepted)`, the rest → `onReject` (default
 * a danger toast `cannotOpenFile(name, accept joined by Intl.ListFormat disjunction)`); a forbidden
 * drop opens nothing. Hidden while no file drag is on the page.
 */
export function createDropZone(context: DropZoneContext): DropZoneController {
  // TODO(web-chrome): window listeners, dragVerdict, chip, onDrop/onReject.
  const { ownerDocument, layer } = context;
  const element = createElement(ownerDocument, "div", {
    class: "cd-shell-drop-zone",
    "data-chrome": "drop-zone",
    "aria-hidden": "true",
  });
  element.hidden = true;
  layer.append(element);
  return {
    element,
    state: () => null,
    destroy() {
      element.remove();
    },
  };
}
