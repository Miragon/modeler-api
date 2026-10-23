import { SHELL } from "../sizes.js";

/** The statuses of guide §3.3 and §9; each colours bar and dot through `--cd-ui-<status>`. */
export type ToastStatus = "success" | "info" | "warning" | "danger";

/** A ghost button before Close (guide §8); the toast then never closes by itself. */
export interface ToastAction {
  label: string;
  /** Runs after the toast closed. */
  onSelect(): void;
}

export interface ToastRequest {
  status: ToastStatus;
  /** What happened and what you can do (guide §2): "Link copied", "Couldn't read this file. …". */
  text: string;
  action?: ToastAction | undefined;
  /** Only to give a long text more time than `TOAST_DURATION_MS`; ignored with an `action`. */
  durationMs?: number | undefined;
}

/** At most three toasts at once, the newest at the bottom (guide §8). */
export const MAX_TOASTS = 3;

/**
 * How long a toast stays without hover or focus (guide §8: about 2.8 s, errors about 5 s). A
 * warning asks you to read a sentence and act on it like an error, so it gets the error's 5 s.
 */
export const TOAST_DURATION_MS: Readonly<Record<ToastStatus, number>> = {
  success: 2800,
  info: 2800,
  warning: 5000,
  danger: 5000,
};

/** The stack's widest toast: `min(480px, 100cqw − 24px)` (guide §8). */
export const TOAST_MAX_WIDTH = 480;

/**
 * Milliseconds until the toast closes by itself: `undefined` with an `action` (it never closes by
 * itself, guide §8), else `max(TOAST_DURATION_MS[status], durationMs ?? 0)`.
 */
export function toastLifetime(request: ToastRequest): number | undefined {
  if (request.action) return undefined;
  const requested = request.durationMs;
  // A NaN or an infinite duration would reach setTimeout, which fires at once for both.
  const longer = requested !== undefined && Number.isFinite(requested) ? requested : 0;
  return Math.max(TOAST_DURATION_MS[request.status], longer);
}

/** A toast in the stack as the eviction sees it, oldest first. */
export interface ToastSlot {
  id: number;
  hasAction: boolean;
  /** Hovered or holding the focus. */
  engaged: boolean;
}

/**
 * Which toast leaves when a fourth arrives (`MAX_TOASTS`): the oldest that is neither engaged nor
 * has an action, else the oldest that is not engaged, else the oldest. `undefined` while the
 * stack has room.
 */
export function toastToEvict(stack: readonly ToastSlot[]): number | undefined {
  if (stack.length < MAX_TOASTS) return undefined;
  const evicted =
    stack.find((slot) => !slot.engaged && !slot.hasAction) ?? stack.find((slot) => !slot.engaged) ?? stack[0];
  return evicted?.id;
}

/** Something in the bottom row the toast stack must clear, relative to the shell root. */
export interface BottomObstacle {
  left: number;
  right: number;
  /** Distance of its top edge from the container's bottom edge. */
  top: number;
}

export interface ToastStackInput {
  containerWidth: number;
  /** The visible zoom panel, legal line and problems pill (not the legend card). */
  obstacles: readonly BottomObstacle[];
  /**
   * Measured width of the widest toast in the stack. The cards are sized to their text and centred
   * in the stack, so only this column can touch an obstacle; absent = the whole `toastStackWidth`.
   */
  cardWidth?: number | undefined;
}

/** `min(TOAST_MAX_WIDTH, containerWidth − 2 · SHELL.edge)`. */
export function toastStackWidth(containerWidth: number): number {
  return Math.max(0, Math.min(TOAST_MAX_WIDTH, containerWidth - 2 * SHELL.edge));
}

/**
 * The stack's `bottom` in px. Guide §8 anchors it at `bottom: 12px`, centred; where the column of
 * its widest card (`cardWidth`, at most `toastStackWidth`, centred) comes closer than `SHELL.gap`
 * horizontally to an obstacle, the stack stands `SHELL.gap` above the highest such obstacle instead
 * (above the legal line 40, above the zoom panel 60, above a raised zoom panel or the web pill 88).
 * Guide §8 states this rule since design system 1.15.0 (Miragon/corporate-identity#37).
 */
export function toastStackBottom(input: ToastStackInput): number {
  const stackWidth = toastStackWidth(input.containerWidth);
  const { cardWidth } = input;
  const width =
    cardWidth !== undefined && Number.isFinite(cardWidth)
      ? Math.min(stackWidth, Math.max(0, cardWidth))
      : stackWidth;
  const left = (input.containerWidth - width) / 2;
  const right = left + width;
  let highest: number | undefined;
  for (const obstacle of input.obstacles) {
    const distance = Math.max(obstacle.left - right, left - obstacle.right);
    if (distance >= SHELL.gap) continue;
    highest = highest === undefined ? obstacle.top : Math.max(highest, obstacle.top);
  }
  return highest === undefined ? SHELL.edge : Math.max(SHELL.edge, highest + SHELL.gap);
}
