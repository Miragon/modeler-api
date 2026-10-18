/**
 * Everything the shell changes outside the elements it creates (classes and attributes on the root,
 * `<html>` and a passed canvas, listeners, observers, timers), recorded so `destroy()` puts it back
 * exactly as it was before `mountShell`.
 */
export class Ledger {
  private readonly undo: (() => void)[] = [];
  private readonly originalAttributes = new Map<Element, Map<string, string | null>>();
  private closed = false;

  get isClosed(): boolean {
    return this.closed;
  }

  /** Runs `task` on `close()`, in reverse order of registration. */
  defer(task: () => void): void {
    this.undo.push(task);
  }

  /** Adds `className` unless present; `close()` removes it only if this ledger added it. */
  addClass(element: Element, className: string): void {
    if (element.classList.contains(className)) return;
    const hadClassAttribute = element.hasAttribute("class");
    element.classList.add(className);
    this.defer(() => {
      element.classList.remove(className);
      if (!hadClassAttribute && element.classList.length === 0) element.removeAttribute("class");
    });
  }

  /** Sets (string) or removes (`null`) an attribute; `close()` restores the value before the first change. */
  attribute(element: Element, name: string, value: string | null): void {
    let originals = this.originalAttributes.get(element);
    if (!originals) {
      originals = new Map();
      this.originalAttributes.set(element, originals);
    }
    if (!originals.has(name)) {
      originals.set(name, element.getAttribute(name));
      this.defer(() => {
        const original = originals.get(name) ?? null;
        if (original === null) element.removeAttribute(name);
        else element.setAttribute(name, original);
      });
    }
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  }

  listen<K extends keyof DocumentEventMap>(
    target: Document,
    type: K,
    listener: (event: DocumentEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void;
  listen<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void;
  listen(
    target: EventTarget,
    type: string,
    listener: (event: never) => void,
    options?: AddEventListenerOptions,
  ): void {
    const handler = listener as EventListener;
    target.addEventListener(type, handler, options);
    this.defer(() => target.removeEventListener(type, handler, options));
  }

  /** Runs every undo task once; later calls are no-ops. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const task of this.undo.reverse()) {
      try {
        task();
      } catch {
        // one failing undo (an element the modeler already removed) must not keep the rest
      }
    }
    this.undo.length = 0;
    this.originalAttributes.clear();
  }
}
