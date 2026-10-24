import type Canvas from "diagram-js/lib/core/Canvas";

const TEXT_FIELD_SELECTOR =
  "input, textarea, select, [contenteditable]:not([contenteditable='false'])";

/**
 * Whether the board may look at this keydown at all: a synthetic `keydown` can come without a key,
 * a listener closer to the target (a menu, a dialog, a host's chrome) may have handled it already,
 * and a key typed while an input method composes belongs to the composition.
 */
export function isUnhandledKey(event: KeyboardEvent): boolean {
  return typeof event.key === "string" && !event.defaultPrevented && !event.isComposing;
}

/**
 * Whether the key is aimed at the canvas: its target is the canvas `<svg>` or lies inside it, the
 * element diagram-js 15 binds its own keyboard to. `<body>` does not count: right after a load,
 * after a click on page text or while a host hides the canvas, a key there is the page's.
 */
export function targetsCanvas(event: Event, canvas: Pick<Canvas, "getContainer">): boolean {
  const svg = canvas.getContainer().querySelector(":scope > svg");
  return svg !== null && event.target instanceof Node && svg.contains(event.target);
}

/** Text fields and editors keep Enter, Escape and the other keys they need for typing. */
export function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if ((target as HTMLElement).isContentEditable) return true;
  if ((target as { editContext?: unknown }).editContext) return true;
  return target.closest(TEXT_FIELD_SELECTOR) !== null;
}
