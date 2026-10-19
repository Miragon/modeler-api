import { createElement } from "./element.js";
import type { InspectorHandle, InspectorOptions } from "./types.js";

export interface InspectorController extends InspectorHandle {
  destroy(): void;
}

export function createInspector(
  ownerDocument: Document,
  options: InspectorOptions,
  onChange: (open: boolean) => void,
): InspectorController {
  const element = createElement(ownerDocument, "aside", {
    class: "cd-shell-inspector",
    "data-chrome": "inspector",
    "aria-label": options.label,
  });
  element.hidden = true;

  function setOpen(open: boolean): void {
    if (open === !element.hidden) return;
    element.hidden = !open;
    onChange(open);
  }

  return {
    element,
    isOpen: () => !element.hidden,
    open: () => setOpen(true),
    close: () => setOpen(false),
    destroy() {
      element.remove();
    },
  };
}
