import {
  acceptsFile,
  dragVerdict,
  type DragItemLike,
  type DragVerdict,
  type ShellMessages,
  type ToastRequest,
} from "../../core/index.js";
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

const DRAG_EVENTS = ["dragenter", "dragover", "dragleave", "drop"] as const;

function carriesFiles(transfer: DataTransfer | null): transfer is DataTransfer {
  if (!transfer) return false;
  if (Array.from(transfer.types ?? []).includes("Files")) return true;
  return Array.from(transfer.items ?? []).some((item) => item.kind === "file");
}

/** What the drag shows of its items; a browser without `items` still names "Files" in `types`. */
function dragItems(transfer: DataTransfer): DragItemLike[] {
  const items = Array.from(transfer.items ?? [], (item) => ({ kind: item.kind, type: item.type }));
  return items.length > 0 ? items : [{ kind: "file", type: "" }];
}

/** The extensions of `accept` for the reject toast ("a .storm, .json, or .txt file"), else every entry. */
function acceptList(accept: readonly string[], lang: string): string {
  const entries = accept.map((entry) => entry.trim()).filter((entry) => entry !== "");
  const extensions = entries.filter((entry) => entry.startsWith("."));
  const listed = extensions.length > 0 ? extensions : entries;
  let format: Intl.ListFormat;
  try {
    format = new Intl.ListFormat(lang, { type: "disjunction" });
  } catch {
    format = new Intl.ListFormat("en", { type: "disjunction" });
  }
  return format.format(listed);
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
  const { ownerDocument, layer, messages, lang, options, modalOpen, toast, setState } = context;
  const chip = createElement(ownerDocument, "span", { class: "cd-shell-drop-zone-chip" });
  const element = createElement(
    ownerDocument,
    "div",
    { class: "cd-shell-drop-zone", "data-chrome": "drop-zone", "aria-hidden": "true" },
    chip,
  );
  element.hidden = true;
  layer.append(element);

  const view = ownerDocument.defaultView;
  // dragenter and dragleave fire for every element the pointer crosses: only the outermost pair counts.
  let depth = 0;
  let current: DropZoneState = null;

  function verdictFor(items: readonly DragItemLike[]): DragVerdict {
    return dragVerdict(items, {
      accept: options.accept,
      multiple: options.multiple ?? false,
      dialogOpen: modalOpen(),
    });
  }

  function show(verdict: DragVerdict): void {
    const next: DropZoneState = verdict.state === "none" ? null : verdict.state;
    if (verdict.state === "over") chip.textContent = messages.dropFile;
    if (verdict.state === "forbidden") chip.textContent = messages.dropForbidden(verdict.reason);
    if (next === current) return;
    current = next;
    element.hidden = next === null;
    if (next === null) element.removeAttribute("data-state");
    else element.setAttribute("data-state", next);
    setState(next);
  }

  function track(transfer: DataTransfer): void {
    const verdict = verdictFor(dragItems(transfer));
    show(verdict);
    transfer.dropEffect = verdict.state === "forbidden" ? "none" : "copy";
  }

  function rejectByDefault(files: readonly File[]): void {
    const accepted = acceptList(options.accept, lang);
    for (const file of files)
      toast({ status: "danger", text: messages.cannotOpenFile(file.name, accepted) });
  }

  function receive(files: readonly File[], verdict: DragVerdict): void {
    // The type verdict only guesses while names are unreadable; at the drop acceptsFile knows.
    if (verdict.state === "forbidden" && verdict.reason !== "type") return;
    const accepted = files.filter((file) => acceptsFile(file, options.accept));
    const rejected = files.filter((file) => !accepted.includes(file));
    if (accepted.length > 0) options.onDrop(accepted);
    if (rejected.length > 0) (options.onReject ?? rejectByDefault)(rejected);
  }

  const onDragEvent = (event: Event): void => {
    const transfer = (event as DragEvent).dataTransfer;
    if (!carriesFiles(transfer)) return;
    // Unprevented, the browser opens the file in place of the app.
    event.preventDefault();
    switch (event.type) {
      case "dragenter":
        depth += 1;
        track(transfer);
        break;
      case "dragover":
        // A drag that entered before the listener existed is on the page all the same.
        depth = Math.max(depth, 1);
        track(transfer);
        break;
      case "dragleave":
        depth = Math.max(0, depth - 1);
        if (depth === 0) show({ state: "none" });
        break;
      case "drop": {
        depth = 0;
        show({ state: "none" });
        const files = Array.from(transfer.files ?? []);
        const items =
          files.length > 0
            ? files.map((file) => ({ kind: "file", type: file.type }))
            : dragItems(transfer);
        receive(files, verdictFor(items));
        break;
      }
    }
  };

  for (const type of DRAG_EVENTS) view?.addEventListener(type, onDragEvent);

  return {
    element,
    state: () => current,
    destroy() {
      for (const type of DRAG_EVENTS) view?.removeEventListener(type, onDragEvent);
      depth = 0;
      if (current !== null) {
        current = null;
        setState(null);
      }
      element.remove();
    },
  };
}
