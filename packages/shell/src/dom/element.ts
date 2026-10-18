type Child = Node | string | undefined | null | false;

/** `document.createElement` with attributes and children; `undefined` attribute values are skipped. */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  ownerDocument: Document,
  tag: K,
  attributes: Readonly<Record<string, string | undefined>> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = ownerDocument.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== undefined) element.setAttribute(name, value);
  }
  for (const child of children) {
    if (child === undefined || child === null || child === false) continue;
    element.append(child);
  }
  return element;
}

/** Sets an attribute, or removes it for `null`/`false`. */
export function toggleAttribute(element: Element, name: string, value: string | null | false): void {
  if (value === null || value === false) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

/** The element's box relative to the padding box of `root` (the containing block of the islands). */
export function boxRelativeTo(element: Element, root: HTMLElement) {
  const box = element.getBoundingClientRect();
  const origin = root.getBoundingClientRect();
  return {
    x: box.left - origin.left - root.clientLeft,
    y: box.top - origin.top - root.clientTop,
    width: box.width,
    height: box.height,
  };
}

/** The accessible name a control shows without its tooltip: `aria-label`, else its text. */
export function accessibleName(control: Element): string {
  return (control.getAttribute("aria-label") ?? control.textContent ?? "").trim();
}

/** True for keyboard focus (`:focus-visible`); engines without the selector count every focus. */
export function hasVisibleFocus(element: Element): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
}
