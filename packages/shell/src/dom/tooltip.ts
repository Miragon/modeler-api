import { TOOLTIP_DELAY_MS, placeTooltip } from "../core/index.js";
import { accessibleName, boxRelativeTo, createElement, hasVisibleFocus } from "./element.js";
import type { TooltipContent, TooltipHandle } from "./types.js";

type ContentSource = TooltipContent | (() => TooltipContent | null);

interface Shown {
  control: HTMLElement;
  describedBy: string | null;
}

export interface TooltipController extends TooltipHandle {
  readonly element: HTMLElement;
  /** One tooltip for every `selector` match inside `container` (palette entries are rebuilt often). */
  delegate(
    container: HTMLElement,
    selector: string,
    content: (control: HTMLElement) => TooltipContent | null,
  ): () => void;
  destroy(): void;
}

export interface TooltipContext {
  root: HTMLElement;
  layer: HTMLElement;
  id: string;
}

export function createTooltip({ root, layer, id }: TooltipContext): TooltipController {
  const ownerDocument = root.ownerDocument;
  const label = createElement(ownerDocument, "span", { class: "cd-shell-tooltip-label" });
  const shortcut = createElement(ownerDocument, "kbd", { class: "cd-shell-kbd" });
  const element = createElement(ownerDocument, "div", { class: "cd-shell-tooltip", role: "tooltip", id });
  element.hidden = true;
  element.append(label, shortcut);
  layer.append(element);

  let shown: Shown | undefined;
  let pending: { control: HTMLElement; timer: ReturnType<typeof setTimeout> } | undefined;
  // After a pointer leaves a control the next one shows at once, so moving along a row of
  // buttons does not wait 300ms for every neighbour (guide §5.6).
  let warmUntil = 0;
  // A clicked control keeps its tooltip hidden until the pointer leaves it.
  let pressed: HTMLElement | undefined;
  const detachers = new Set<() => void>();

  function cancelPending(): void {
    if (pending) clearTimeout(pending.timer);
    pending = undefined;
  }

  function resolve(source: ContentSource): TooltipContent | null {
    return typeof source === "function" ? source() : source;
  }

  function place(control: HTMLElement): void {
    const island = control.closest<HTMLElement>("[data-chrome]") ?? control;
    const point = placeTooltip({
      anchor: boxRelativeTo(control, root),
      island: boxRelativeTo(island, root),
      tooltip: { width: element.offsetWidth, height: element.offsetHeight },
      container: { width: root.clientWidth, height: root.clientHeight },
    });
    element.style.left = `${point.x}px`;
    element.style.top = `${point.y}px`;
  }

  function hide(): void {
    cancelPending();
    if (!shown) return;
    const { control, describedBy } = shown;
    shown = undefined;
    element.hidden = true;
    if (describedBy === null) control.removeAttribute("aria-describedby");
    else control.setAttribute("aria-describedby", describedBy);
  }

  function show(control: HTMLElement, source: ContentSource): void {
    cancelPending();
    const content = resolve(source);
    if (!content || !control.isConnected) {
      if (shown?.control === control) hide();
      return;
    }
    if (shown && shown.control !== control) hide();
    label.textContent = content.label;
    shortcut.textContent = content.shortcut ?? "";
    shortcut.hidden = !content.shortcut;
    element.hidden = false;
    if (!shown) {
      const describedBy = control.getAttribute("aria-describedby");
      shown = { control, describedBy };
      // Only a tooltip that says more than the control's name describes it (guide §5.6); a shortcut
      // chip does, unless the control names its keys in aria-keyshortcuts.
      const saysMore =
        !accessibleName(control).includes(content.label) ||
        (Boolean(content.shortcut) && !control.hasAttribute("aria-keyshortcuts"));
      if (saysMore) {
        control.setAttribute("aria-describedby", [describedBy, id].filter(Boolean).join(" "));
      }
    }
    place(control);
  }

  function onEnter(control: HTMLElement, source: ContentSource, event: PointerEvent): void {
    if (event.pointerType === "touch" || pressed === control) return;
    if (shown || Date.now() < warmUntil) {
      show(control, source);
      return;
    }
    cancelPending();
    pending = { control, timer: setTimeout(() => show(control, source), TOOLTIP_DELAY_MS) };
  }

  function onLeave(control: HTMLElement): void {
    if (pressed === control) pressed = undefined;
    if (pending?.control === control) cancelPending();
    if (shown?.control === control) {
      hide();
      warmUntil = Date.now() + TOOLTIP_DELAY_MS;
    }
  }

  function onFocus(control: HTMLElement, source: ContentSource): void {
    if (hasVisibleFocus(control)) show(control, source);
  }

  function onBlur(control: HTMLElement): void {
    if (pending?.control === control) cancelPending();
    if (shown?.control === control) hide();
  }

  function onPress(control: HTMLElement, event: Event): void {
    if (event.type === "pointerdown") pressed = control;
    if (pending?.control === control) cancelPending();
    if (shown?.control === control) hide();
  }

  function attach(control: HTMLElement, source: ContentSource): () => void {
    const enter = (event: PointerEvent) => onEnter(control, source, event);
    const leave = () => onLeave(control);
    const focus = () => onFocus(control, source);
    const blur = () => onBlur(control);
    const press = (event: Event) => onPress(control, event);
    control.addEventListener("pointerenter", enter);
    control.addEventListener("pointerleave", leave);
    control.addEventListener("focus", focus);
    control.addEventListener("blur", blur);
    control.addEventListener("pointerdown", press);
    control.addEventListener("click", press);
    const detach = () => {
      if (!detachers.delete(detach)) return;
      control.removeEventListener("pointerenter", enter);
      control.removeEventListener("pointerleave", leave);
      control.removeEventListener("focus", focus);
      control.removeEventListener("blur", blur);
      control.removeEventListener("pointerdown", press);
      control.removeEventListener("click", press);
      if (shown?.control === control || pending?.control === control) hide();
      if (pressed === control) pressed = undefined;
    };
    detachers.add(detach);
    return detach;
  }

  function delegate(
    container: HTMLElement,
    selector: string,
    content: (control: HTMLElement) => TooltipContent | null,
  ): () => void {
    let hovered: HTMLElement | undefined;
    const controlOf = (target: EventTarget | null): HTMLElement | undefined => {
      if (!target || typeof (target as Element).closest !== "function") return undefined;
      const match = (target as Element).closest<HTMLElement>(selector);
      return match && container.contains(match) ? match : undefined;
    };
    const sourceOf = (control: HTMLElement) => () => content(control);
    const over = (event: PointerEvent) => {
      const control = controlOf(event.target);
      if (control === hovered) return;
      if (hovered) onLeave(hovered);
      hovered = control;
      if (control) onEnter(control, sourceOf(control), event);
    };
    const out = (event: PointerEvent) => {
      if (!hovered) return;
      if (controlOf(event.relatedTarget) === hovered) return;
      onLeave(hovered);
      hovered = undefined;
    };
    const focusIn = (event: FocusEvent) => {
      const control = controlOf(event.target);
      if (control) onFocus(control, sourceOf(control));
    };
    const focusOut = (event: FocusEvent) => {
      const control = controlOf(event.target);
      if (control) onBlur(control);
    };
    const press = (event: Event) => {
      const control = controlOf(event.target);
      if (control) onPress(control, event);
    };
    container.addEventListener("pointerover", over);
    container.addEventListener("pointerout", out);
    container.addEventListener("focusin", focusIn);
    container.addEventListener("focusout", focusOut);
    container.addEventListener("pointerdown", press);
    container.addEventListener("click", press);
    const detach = () => {
      if (!detachers.delete(detach)) return;
      container.removeEventListener("pointerover", over);
      container.removeEventListener("pointerout", out);
      container.removeEventListener("focusin", focusIn);
      container.removeEventListener("focusout", focusOut);
      container.removeEventListener("pointerdown", press);
      container.removeEventListener("click", press);
      if ((shown && container.contains(shown.control)) || (pending && container.contains(pending.control))) {
        hide();
      }
      hovered = undefined;
    };
    detachers.add(detach);
    return detach;
  }

  return {
    element,
    attach,
    delegate,
    hide,
    destroy() {
      hide();
      for (const detach of [...detachers]) detach();
      element.remove();
    },
  };
}
