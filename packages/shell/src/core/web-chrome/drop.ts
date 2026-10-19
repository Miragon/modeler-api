/** Why a drag cannot be dropped (guide §9 Drop forbidden); `messages.dropForbidden` words each one. */
export type DropForbiddenReason = "multiple" | "type" | "dialog";

/** One entry of `DataTransfer.items` as a drag shows it (names are not readable before the drop). */
export interface DragItemLike {
  kind: string;
  type: string;
}

export interface DragContext {
  /** `DropZoneOptions.accept`: extensions (".storm") and MIME types ("application/json", "text/*"). */
  accept: readonly string[];
  /** `DropZoneOptions.multiple`. */
  multiple: boolean;
  /** A modal dialog is open (the shell's dialog test, as for the keys). */
  dialogOpen: boolean;
}

/** What the drop zone shows for the drag over the page right now (guide §9). */
export type DragVerdict =
  { state: "none" } | { state: "over" } | { state: "forbidden"; reason: DropForbiddenReason };

/**
 * The drop zone's state for a drag (guide §9, Drag-over and Drop forbidden):
 *
 * - `none`: no item of kind `file` (a palette drag, selected text): the drop zone stays out of it.
 * - `forbidden` / `dialog`: a modal dialog is open.
 * - `forbidden` / `multiple`: more than one file and `multiple` is false.
 * - `forbidden` / `type`: `accept` lists at least one MIME type and every file item carries a
 *   non-empty type that none of them matches (`type/*` wildcards included). Extensions cannot be
 *   checked before the drop, and an empty type (".storm" has none) never forbids.
 * - `over` otherwise.
 */
export function dragVerdict(items: readonly DragItemLike[], context: DragContext): DragVerdict {
  // TODO(web-chrome): the forbidden reasons above, in this order.
  void context;
  return items.some((item) => item.kind === "file") ? { state: "over" } : { state: "none" };
}

/**
 * A dropped file matches `accept` like `<input accept>`: an entry starting with "." matches the
 * end of the name (case-insensitive), an entry with "/" the MIME type exactly or as `type/*`; an
 * empty `accept` matches every file.
 */
export function acceptsFile(file: { name: string; type: string }, accept: readonly string[]): boolean {
  // TODO(web-chrome): extension and MIME matching above.
  void file;
  void accept;
  return true;
}
