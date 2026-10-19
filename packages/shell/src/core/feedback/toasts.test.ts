import { describe, expect, it } from "vitest";
import {
  MAX_TOASTS,
  TOAST_DURATION_MS,
  TOAST_MAX_WIDTH,
  toastLifetime,
  toastStackBottom,
  toastStackWidth,
  toastToEvict,
  type BottomObstacle,
  type ToastSlot,
} from "./toasts.js";

describe("constants (guide §8)", () => {
  it("keep at most three toasts, 480px wide, 2.8s and 5s for errors and warnings", () => {
    expect(MAX_TOASTS).toBe(3);
    expect(TOAST_MAX_WIDTH).toBe(480);
    expect(TOAST_DURATION_MS).toEqual({ success: 2800, info: 2800, warning: 5000, danger: 5000 });
  });
});

describe("toastLifetime", () => {
  it("is the status's duration", () => {
    expect(toastLifetime({ status: "success", text: "Link copied" })).toBe(2800);
    expect(toastLifetime({ status: "info", text: "Opened" })).toBe(2800);
    expect(toastLifetime({ status: "warning", text: "Imported with 2 warnings" })).toBe(5000);
    expect(toastLifetime({ status: "danger", text: "Couldn't read this file." })).toBe(5000);
  });

  it("only lengthens with durationMs", () => {
    expect(toastLifetime({ status: "success", text: "A long text", durationMs: 9000 })).toBe(9000);
    expect(toastLifetime({ status: "success", text: "Short", durationMs: 1000 })).toBe(2800);
    expect(toastLifetime({ status: "danger", text: "Short", durationMs: 0 })).toBe(5000);
  });

  it("ignores a duration setTimeout cannot take", () => {
    expect(toastLifetime({ status: "info", text: "x", durationMs: Number.NaN })).toBe(2800);
    expect(toastLifetime({ status: "info", text: "x", durationMs: Number.POSITIVE_INFINITY })).toBe(2800);
  });

  it("is undefined with an action, whatever durationMs says (it never closes by itself)", () => {
    const action = { label: "Undo", onSelect() {} };
    expect(toastLifetime({ status: "info", text: "Board replaced", action })).toBeUndefined();
    expect(
      toastLifetime({ status: "info", text: "Board replaced", action, durationMs: 9000 }),
    ).toBeUndefined();
  });
});

describe("toastToEvict", () => {
  const slot = (id: number, flags: Partial<Omit<ToastSlot, "id">> = {}): ToastSlot => ({
    id,
    hasAction: false,
    engaged: false,
    ...flags,
  });

  it("is undefined while the stack has room", () => {
    expect(toastToEvict([])).toBeUndefined();
    expect(toastToEvict([slot(1), slot(2)])).toBeUndefined();
  });

  it("evicts the oldest when nothing is engaged and nothing has an action", () => {
    expect(toastToEvict([slot(1), slot(2), slot(3)])).toBe(1);
  });

  it("prefers the oldest that is neither engaged nor has an action", () => {
    expect(toastToEvict([slot(1, { hasAction: true }), slot(2), slot(3)])).toBe(2);
    expect(toastToEvict([slot(1, { engaged: true }), slot(2, { hasAction: true }), slot(3)])).toBe(3);
  });

  it("then the oldest that is not engaged, an action toast included", () => {
    expect(
      toastToEvict([slot(1, { engaged: true }), slot(2, { hasAction: true }), slot(3, { hasAction: true })]),
    ).toBe(2);
  });

  it("then the oldest", () => {
    expect(
      toastToEvict([
        slot(1, { engaged: true, hasAction: true }),
        slot(2, { engaged: true }),
        slot(3, { engaged: true }),
      ]),
    ).toBe(1);
  });
});

describe("toastStackWidth", () => {
  it("is min(480, width − 24)", () => {
    expect(toastStackWidth(1280)).toBe(480);
    expect(toastStackWidth(504)).toBe(480);
    expect(toastStackWidth(503)).toBe(479);
    expect(toastStackWidth(420)).toBe(396);
  });

  it("never goes below 0", () => {
    expect(toastStackWidth(24)).toBe(0);
    expect(toastStackWidth(10)).toBe(0);
    expect(toastStackWidth(0)).toBe(0);
  });
});

describe("toastStackBottom", () => {
  // Boxes as the shell measures them in the web host: legal line 20 high at bottom 12, zoom panel
  // 173 × 40 at right 12 (bottom 12, raised 40), the web pill 40 high at bottom 40.
  const legal = (right = 342): BottomObstacle => ({ left: 12, right, top: 32 });
  const zoom = (width: number, raised = false): BottomObstacle => ({
    left: width - 12 - 173,
    right: width - 12,
    top: raised ? 80 : 52,
  });
  const webPill = (right = 132): BottomObstacle => ({ left: 12, right, top: 80 });

  it("stands at 12px without obstacles (guide §8)", () => {
    expect(toastStackBottom({ containerWidth: 1280, obstacles: [] })).toBe(12);
  });

  it("1280: the centred column clears the whole bottom row", () => {
    // Column 400…880.
    expect(toastStackBottom({ containerWidth: 1280, obstacles: [legal(), webPill(), zoom(1280)] })).toBe(12);
  });

  it("1000: stands 8px above the legal line it would touch", () => {
    // Column 260…740; the legal line ends at 342, the zoom panel starts at 815.
    expect(toastStackBottom({ containerWidth: 1000, obstacles: [legal(), webPill(), zoom(1000)] })).toBe(40);
  });

  it("420: stands 8px above the highest of the bottom row", () => {
    // Column 12…408 spans the whole row.
    expect(toastStackBottom({ containerWidth: 420, obstacles: [legal(), zoom(420)] })).toBe(60);
    expect(toastStackBottom({ containerWidth: 420, obstacles: [legal(), zoom(420, true)] })).toBe(88);
    expect(toastStackBottom({ containerWidth: 420, obstacles: [legal(), webPill(), zoom(420)] })).toBe(88);
  });

  it("420 in the IDE column: above the zoom panel and the pill at 12", () => {
    const pill: BottomObstacle = { left: 12, right: 132, top: 52 };
    expect(toastStackBottom({ containerWidth: 420, obstacles: [pill, zoom(420)] })).toBe(60);
  });

  it("counts an obstacle closer than 8px, not one exactly 8px away", () => {
    // Column 400…880 at 1280.
    expect(toastStackBottom({ containerWidth: 1280, obstacles: [legal(392)] })).toBe(12);
    expect(toastStackBottom({ containerWidth: 1280, obstacles: [legal(393)] })).toBe(40);
    expect(toastStackBottom({ containerWidth: 1280, obstacles: [{ left: 888, right: 900, top: 52 }] })).toBe(
      12,
    );
    expect(toastStackBottom({ containerWidth: 1280, obstacles: [{ left: 887, right: 900, top: 52 }] })).toBe(
      60,
    );
  });

  it("ignores obstacles off to the side, however high", () => {
    expect(
      toastStackBottom({ containerWidth: 1280, obstacles: [{ left: 12, right: 200, top: 400 }, zoom(1280)] }),
    ).toBe(12);
  });

  it("never sinks below 12px", () => {
    expect(toastStackBottom({ containerWidth: 1280, obstacles: [{ left: 500, right: 600, top: 0 }] })).toBe(
      12,
    );
  });
});
