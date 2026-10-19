import { ariaKeyShortcutsFromLabel, type ShellMessages } from "../../core/index.js";
import { createElement } from "../element.js";
import type { EmptyStateOptions, FileMenuAction } from "../types.js";

export interface EmptyStateContext {
  ownerDocument: Document;
  messages: ShellMessages;
  options: EmptyStateOptions;
  /** The drop hint under the buttons; `undefined` without a drop zone. */
  dropHint: string | undefined;
  /**
   * The File group's "Open…": the hint offers it as a text link, the keyboard's way to a file
   * while the start screen hides the menu and a drop needs a pointer. `undefined` without one.
   */
  open?: FileMenuAction | undefined;
  /** `id` of the title, the section's `aria-labelledby`. */
  titleId: string;
  /** Runs before `onNewDiagram` / `onShowExample`: the shell hides the card and moves the focus. */
  onLeave(): void;
}

export interface EmptyStateController {
  /** The `<section data-chrome="empty-state">`. */
  readonly element: HTMLElement;
  isShown(): boolean;
  setShown(shown: boolean): void;
  /** Focuses "New diagram", the card's first button. */
  focus(): void;
  destroy(): void;
}

/** The Komet's size on the card (guide §8). */
const KOMET_SIZE = "64";

/**
 * `<section class="cd-shell-empty-state" data-chrome="empty-state" aria-labelledby>` (guide §8):
 * centred in the container, `min(400px, 100cqw − 24px)` wide, glass, `shadow-2`, radius `lg`,
 * padding `32px 40px`, content centred with 16px gaps: `<img src=komet width=64 height=64
 * alt="">`, `<h1>` title 21px/600, help 16px/1.6 `--cd-ui-text-leise`, then the buttons side by
 * side with 8px gap, 36px high (`cd-shell-button`): primary "New diagram" first, ghost "Show
 * example", then the drop hint 13px `--cd-ui-text-leise`. With the File group's "Open…" the hint
 * ends in a text link `messages.openFileLink` in `--cd-ui-link` (and its shortcut chip in Geist
 * Mono): not a third action, the keyboard's way to open a file. Opening keeps the card until the
 * modeler leaves it (`setEmptyState(false)` after the file loaded). Layer 20, `hidden` until
 * `setShown(true)`.
 */
export function createEmptyState(context: EmptyStateContext): EmptyStateController {
  const { ownerDocument, messages, options, dropHint, open, titleId, onLeave } = context;

  const button = (variant: "primary" | "ghost", label: string, run: () => void): HTMLButtonElement => {
    const element = createElement(
      ownerDocument,
      "button",
      { type: "button", class: "cd-shell-button", "data-variant": variant },
      label,
    );
    element.addEventListener("click", () => {
      onLeave();
      run();
    });
    return element;
  };

  const onShowExample = options.onShowExample;
  const newDiagram = button("primary", messages.newDiagram, () => options.onNewDiagram());
  const element = createElement(
    ownerDocument,
    "section",
    { class: "cd-shell-empty-state", "data-chrome": "empty-state", "aria-labelledby": titleId },
    // Dragging the mark would start an image drag that some browsers carry as a file.
    createElement(ownerDocument, "img", {
      class: "cd-shell-empty-state-mark",
      src: options.komet,
      width: KOMET_SIZE,
      height: KOMET_SIZE,
      alt: "",
      draggable: "false",
    }),
    createElement(ownerDocument, "h1", { class: "cd-shell-empty-state-title", id: titleId }, options.title),
    createElement(ownerDocument, "p", { class: "cd-shell-empty-state-text" }, options.text),
    createElement(
      ownerDocument,
      "div",
      { class: "cd-shell-empty-state-actions" },
      newDiagram,
      onShowExample && button("ghost", messages.showExample, () => onShowExample()),
    ),
    hintParagraph(),
  );

  function hintParagraph(): HTMLElement | undefined {
    const hasDropHint = dropHint !== undefined && dropHint !== "";
    if (!hasDropHint && !open) return undefined;
    const paragraph = createElement(ownerDocument, "p", { class: "cd-shell-empty-state-hint" });
    if (hasDropHint) paragraph.append(dropHint);
    if (!open) return paragraph;
    const shortcut = open.shortcut?.trim();
    const link = createElement(
      ownerDocument,
      "button",
      {
        type: "button",
        class: "cd-shell-empty-state-open",
        "aria-keyshortcuts": shortcut ? ariaKeyShortcutsFromLabel(shortcut) : undefined,
        "aria-haspopup": open.dialog ? "dialog" : undefined,
      },
      messages.openFileLink,
    );
    link.addEventListener("click", () => open.onSelect());
    if (hasDropHint) {
      paragraph.append(" ", createElement(ownerDocument, "span", { "aria-hidden": "true" }, "·"), " ");
    }
    // The link and its chip wrap as one: a chip alone on a line names no action.
    const openItem = createElement(ownerDocument, "span", { class: "cd-shell-empty-state-open-item" }, link);
    if (shortcut) {
      openItem.append(
        " ",
        createElement(
          ownerDocument,
          "kbd",
          { class: "cd-shell-empty-state-key", "aria-hidden": "true" },
          shortcut,
        ),
      );
    }
    paragraph.append(openItem);
    return paragraph;
  }
  element.hidden = true;

  return {
    element,
    isShown: () => !element.hidden,
    setShown(shown) {
      element.hidden = !shown;
    },
    focus() {
      newDiagram.focus({ preventScroll: true });
    },
    destroy() {
      element.remove();
    },
  };
}
