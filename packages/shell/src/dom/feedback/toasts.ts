import {
  MAX_TOASTS,
  REDUCED_MOTION_CLASS,
  toastLifetime,
  toastToEvict,
  type ShellHost,
  type ShellMessages,
  type ToastAction,
  type ToastRequest,
  type ToastSlot,
} from "../../core/index.js";
import { createElement } from "../element.js";
import { iconElement } from "../icons.js";
import type { ToastHandle } from "../types.js";

export interface ToasterContext {
  ownerDocument: Document;
  /** `web`: the stack is a `popover="manual"` raised on every toast; `embedded`: absolute in the root. */
  host: Exclude<ShellHost, "ide">;
  messages: ShellMessages;
  /** Where the focus goes when a closing toast held it and no other toast can take it. */
  focusFallback(): void;
}

export interface Toaster {
  /** The stack `<div class="cd-shell-toasts" data-chrome="toasts">`, always in the DOM, empty = no box. */
  readonly element: HTMLElement;
  show(request: ToastRequest): ToastHandle;
  /** The stack's `bottom` in px from `toastStackBottom`, set by the shell's layout pass. */
  setBottom(bottom: number): void;
  destroy(): void;
}

/** A paused toast resumes with at least this long, so it does not vanish the moment the pointer leaves. */
export const TOAST_RESUME_MIN_MS = 1500;

/** The leave animation runs `--cd-motion-base` (250ms); the toast goes after this even without `animationend`. */
export const TOAST_LEAVE_FALLBACK_MS = 400;

/** The keyframes of feedback.css the leaving toast runs. */
const LEAVE_ANIMATION = "cd-shell-toast-out";

const INERT_HANDLE: ToastHandle = Object.freeze({ dismiss() {} });

interface LiveToast {
  readonly id: number;
  readonly element: HTMLElement;
  readonly closeButton: HTMLButtonElement;
  readonly handle: ToastHandle;
  request: ToastRequest;
  actionButton: HTMLButtonElement | undefined;
  hovered: boolean;
  focused: boolean;
  /** Milliseconds left while paused, the whole lifetime while running; `undefined` never closes. */
  remaining: number | undefined;
  startedAt: number;
  timer: ReturnType<typeof setTimeout> | undefined;
}

/**
 * The toast stack (guide §8, §9): centred at `bottom` (`toastStackBottom`), `toastStackWidth`
 * wide, column with 8px gap, newest at the bottom, layer 60 (`--cd-shell-ebene-toast`). In the
 * web host the stack is a manual popover, re-shown on every toast, so it stays above a
 * `showModal()` dialog in the top layer; in the embedded host it is absolute inside the root.
 *
 * A toast: `<div class="cd-shell-toast" data-status role="status|alert">` (`alert` for danger,
 * `status` with its implicit polite live region otherwise), opaque `--cd-ui-flaeche-hoch`, 1px
 * `--cd-ui-linie`, a straight 4px bar and an 8px dot in `--cd-ui-<status>`, radius `md`,
 * `shadow-3`, at least 40px high, padding `4px 4px 4px 16px`, gap 8px, text 13px/1.5
 * `--cd-ui-text`; then the action as a 32px ghost button and Close as a 32 × 32 ghost icon button
 * (Lucide `x`, `aria-label` `messages.close`). Slide and fade in from `translateY(8px)` (250ms),
 * out the same way; none under reduced motion.
 *
 * Lifetime `toastLifetime(request)`, paused while hovered or focused (and resumed with at least
 * 1.5 s left); a toast with an action never closes by itself. A fourth toast evicts per
 * `toastToEvict`. A request equal to a shown toast (status and text) restarts that toast's timer
 * instead of stacking a second; its action and lifetime become the new request's, so an "Undo"
 * always undoes the latest change. An action click closes the toast, then runs `onSelect`. A
 * closing toast that held the focus hands it to the next toast's Close button, else
 * `focusFallback()`.
 */
export function createToaster(context: ToasterContext): Toaster {
  const { ownerDocument, messages } = context;
  const web = context.host === "web";
  const element = createElement(ownerDocument, "div", {
    class: "cd-shell-toasts",
    "data-chrome": "toasts",
    popover: web ? "manual" : undefined,
  });

  /** Shown toasts, oldest first; a leaving toast is no longer one of them. */
  const live: LiveToast[] = [];
  const leaveTimers = new Set<ReturnType<typeof setTimeout>>();
  let lastId = 0;
  let destroyed = false;

  function supportsPopover(): boolean {
    return web && typeof element.showPopover === "function" && typeof element.hidePopover === "function";
  }

  // Showing a popover again puts it on top of the top layer, above a modal dialog opened since.
  function raise(): void {
    if (!supportsPopover() || !element.isConnected) return;
    const focused = ownerDocument.activeElement as HTMLElement | null;
    const keepFocus = focused && element.contains(focused) ? focused : undefined;
    try {
      element.hidePopover();
      element.showPopover();
    } catch {
      return;
    }
    if (keepFocus && ownerDocument.activeElement !== keepFocus) keepFocus.focus({ preventScroll: true });
  }

  function lowerWhenEmpty(): void {
    if (element.childElementCount > 0 || !supportsPopover()) return;
    try {
      element.hidePopover();
    } catch {
      // Not shown (or never connected): nothing to hide.
    }
  }

  function engaged(toast: LiveToast): boolean {
    return toast.hovered || toast.focused;
  }

  function stopTimer(toast: LiveToast): void {
    clearTimeout(toast.timer);
    toast.timer = undefined;
  }

  function runTimer(toast: LiveToast): void {
    stopTimer(toast);
    if (toast.remaining === undefined || engaged(toast)) return;
    toast.startedAt = Date.now();
    toast.timer = setTimeout(() => close(toast), toast.remaining);
  }

  function pause(toast: LiveToast): void {
    if (toast.timer === undefined) return;
    stopTimer(toast);
    if (toast.remaining !== undefined) {
      toast.remaining = Math.max(0, toast.remaining - (Date.now() - toast.startedAt));
    }
  }

  function setEngagement(toast: LiveToast, hovered: boolean, focused: boolean): void {
    if (!live.includes(toast)) return;
    const wasEngaged = engaged(toast);
    toast.hovered = hovered;
    toast.focused = focused;
    if (engaged(toast) === wasEngaged) return;
    if (wasEngaged) {
      if (toast.remaining !== undefined) toast.remaining = Math.max(toast.remaining, TOAST_RESUME_MIN_MS);
      runTimer(toast);
    } else {
      pause(toast);
    }
  }

  function reducedMotion(): boolean {
    if (ownerDocument.documentElement.classList.contains(REDUCED_MOTION_CLASS)) return true;
    const view = ownerDocument.defaultView;
    return (
      typeof view?.matchMedia === "function" && view.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function removeElement(toastElement: HTMLElement): void {
    toastElement.remove();
    lowerWhenEmpty();
  }

  function leave(toastElement: HTMLElement): void {
    toastElement.setAttribute("data-leaving", "");
    // Nothing on its way out takes a click or the focus.
    toastElement.inert = true;
    if (reducedMotion()) {
      removeElement(toastElement);
      return;
    }
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      clearTimeout(fallback);
      leaveTimers.delete(fallback);
      removeElement(toastElement);
    };
    toastElement.addEventListener("animationend", (event) => {
      if (event.target === toastElement && event.animationName === LEAVE_ANIMATION) finish();
    });
    const fallback = setTimeout(finish, TOAST_LEAVE_FALLBACK_MS);
    leaveTimers.add(fallback);
  }

  function close(toast: LiveToast): void {
    const index = live.indexOf(toast);
    if (index < 0) return;
    live.splice(index, 1);
    stopTimer(toast);
    const heldFocus = toast.element.contains(ownerDocument.activeElement);
    if (heldFocus) {
      const next = live[index] ?? live[index - 1];
      if (next) next.closeButton.focus({ preventScroll: true });
      else context.focusFallback();
    }
    leave(toast.element);
  }

  function setAction(toast: LiveToast, action: ToastAction | undefined): void {
    const previous = toast.actionButton;
    const hadFocus = previous !== undefined && ownerDocument.activeElement === previous;
    previous?.remove();
    toast.actionButton = undefined;
    if (action) {
      const button = createElement(
        ownerDocument,
        "button",
        { type: "button", class: "cd-shell-toast-action cd-shell-button", "data-variant": "ghost" },
        action.label,
      );
      button.addEventListener("click", () => {
        close(toast);
        action.onSelect();
      });
      toast.closeButton.before(button);
      toast.actionButton = button;
    }
    if (hadFocus) (toast.actionButton ?? toast.closeButton).focus({ preventScroll: true });
  }

  function slotOf(toast: LiveToast): ToastSlot {
    return { id: toast.id, hasAction: toast.request.action !== undefined, engaged: engaged(toast) };
  }

  function render(request: ToastRequest): LiveToast {
    const id = ++lastId;
    const closeButton = createElement(
      ownerDocument,
      "button",
      { type: "button", class: "cd-shell-toast-close", "aria-label": messages.close },
      iconElement("x"),
    );
    const toastElement = createElement(
      ownerDocument,
      "div",
      {
        class: "cd-shell-toast",
        "data-status": request.status,
        role: request.status === "danger" ? "alert" : "status",
      },
      createElement(ownerDocument, "span", { class: "cd-shell-toast-dot", "aria-hidden": "true" }),
      createElement(ownerDocument, "span", { class: "cd-shell-toast-text" }, request.text),
      closeButton,
    );
    const toast: LiveToast = {
      id,
      element: toastElement,
      closeButton,
      handle: Object.freeze({ dismiss: () => close(toast) }),
      request,
      actionButton: undefined,
      hovered: false,
      focused: false,
      remaining: toastLifetime(request),
      startedAt: Date.now(),
      timer: undefined,
    };
    setAction(toast, request.action);
    closeButton.addEventListener("click", () => close(toast));
    toastElement.addEventListener("mouseenter", () => setEngagement(toast, true, toast.focused));
    toastElement.addEventListener("mouseleave", () => setEngagement(toast, false, toast.focused));
    toastElement.addEventListener("focusin", () => setEngagement(toast, toast.hovered, true));
    toastElement.addEventListener("focusout", (event) =>
      setEngagement(toast, toast.hovered, toastElement.contains(event.relatedTarget as Node | null)),
    );
    return toast;
  }

  function show(request: ToastRequest): ToastHandle {
    if (destroyed) return INERT_HANDLE;
    const same = live.find(
      (toast) => toast.request.status === request.status && toast.request.text === request.text,
    );
    if (same) {
      same.request = request;
      setAction(same, request.action);
      same.remaining = toastLifetime(request);
      runTimer(same);
      raise();
      return same.handle;
    }
    while (live.length >= MAX_TOASTS) {
      const evictedId = toastToEvict(live.map(slotOf));
      const evicted = live.find((toast) => toast.id === evictedId) ?? live[0];
      if (!evicted) break;
      close(evicted);
    }
    const toast = render(request);
    live.push(toast);
    element.append(toast.element);
    raise();
    runTimer(toast);
    return toast.handle;
  }

  return {
    element,
    show,
    setBottom(bottom) {
      element.style.bottom = `${bottom}px`;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const toast of live.splice(0)) stopTimer(toast);
      for (const timer of leaveTimers) clearTimeout(timer);
      leaveTimers.clear();
      element.remove();
    },
  };
}
