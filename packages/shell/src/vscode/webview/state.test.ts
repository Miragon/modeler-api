import { describe, expect, it, vi } from "vitest";

import {
  SHELL_STATE_KEY,
  persistView,
  readShellState,
  writeShellState,
  type PersistableView,
  type WebviewStateApi,
} from "./index.js";

function memoryApi(
  initial?: unknown,
): WebviewStateApi & { state: unknown; setState: ReturnType<typeof vi.fn> } {
  const api = {
    state: initial,
    getState: () => api.state,
    setState: vi.fn((next: unknown) => {
      api.state = next;
    }),
  };
  return api;
}

const VIEW = { viewbox: { x: -40, y: 12.5, width: 1280, height: 900 }, userMoved: true };

describe("readShellState", () => {
  it.each([
    ["no state", undefined],
    ["null", null],
    ["a string", "garbage"],
    ["an array", [1, 2]],
    ["a state without the shell's key", { other: 1 }],
    ["a shell part that is no object", { [SHELL_STATE_KEY]: "open" }],
  ])("returns {} for %s", (_name, state) => {
    expect(readShellState(memoryApi(state))).toEqual({});
  });

  it("reads legend state and view from the shell's key", () => {
    const api = memoryApi({ other: 1, [SHELL_STATE_KEY]: { legendOpen: false, view: VIEW } });
    expect(readShellState(api)).toEqual({ legendOpen: false, view: VIEW });
  });

  it("drops malformed values and keeps the valid ones", () => {
    const api = memoryApi({
      [SHELL_STATE_KEY]: {
        legendOpen: "yes",
        view: { viewbox: { x: 0, y: 0, width: 10 }, userMoved: true },
      },
    });
    expect(readShellState(api)).toEqual({});

    const withLegend = memoryApi({
      [SHELL_STATE_KEY]: { legendOpen: true, view: { viewbox: VIEW.viewbox } },
    });
    expect(readShellState(withLegend)).toEqual({ legendOpen: true });
  });

  it.each([
    ["a zero width", { ...VIEW.viewbox, width: 0 }],
    ["a negative height", { ...VIEW.viewbox, height: -1 }],
    ["a non-finite coordinate", { ...VIEW.viewbox, x: Number.POSITIVE_INFINITY }],
    ["a string coordinate", { ...VIEW.viewbox, y: "12" }],
  ])("ignores a view with %s", (_name, viewbox) => {
    expect(
      readShellState(memoryApi({ [SHELL_STATE_KEY]: { view: { viewbox, userMoved: false } } })),
    ).toEqual({});
  });

  it("returns only the known fields", () => {
    const api = memoryApi({
      [SHELL_STATE_KEY]: {
        legendOpen: true,
        future: 1,
        view: { ...VIEW, scale: 2, viewbox: { ...VIEW.viewbox, scale: 2 } },
      },
    });
    expect(readShellState(api)).toEqual({ legendOpen: true, view: VIEW });
  });
});

describe("writeShellState", () => {
  it("writes the shell's part under its key into an empty state", () => {
    const api = memoryApi();
    writeShellState(api, { legendOpen: true });
    expect(api.state).toEqual({ [SHELL_STATE_KEY]: { legendOpen: true } });
  });

  it("merges into the shell's part and keeps every other key", () => {
    const api = memoryApi({ typeCaptionsVisible: false, [SHELL_STATE_KEY]: { legendOpen: false } });

    writeShellState(api, { view: VIEW });
    expect(api.state).toEqual({
      typeCaptionsVisible: false,
      [SHELL_STATE_KEY]: { legendOpen: false, view: VIEW },
    });

    writeShellState(api, { legendOpen: true });
    expect(api.state).toEqual({
      typeCaptionsVisible: false,
      [SHELL_STATE_KEY]: { legendOpen: true, view: VIEW },
    });
    expect(readShellState(api)).toEqual({ legendOpen: true, view: VIEW });
  });

  it("keeps the state it does not know inside its own part", () => {
    const api = memoryApi({ [SHELL_STATE_KEY]: { future: "x" } });
    writeShellState(api, { legendOpen: true });
    expect(api.state).toEqual({ [SHELL_STATE_KEY]: { future: "x", legendOpen: true } });
  });

  it("leaves a stored value alone for undefined or malformed patch values", () => {
    const api = memoryApi({ [SHELL_STATE_KEY]: { legendOpen: true, view: VIEW } });
    writeShellState(api, { view: undefined, legendOpen: undefined });
    writeShellState(api, {
      view: { viewbox: { x: 0, y: 0, width: 0, height: 0 }, userMoved: false },
    });
    expect(api.state).toEqual({ [SHELL_STATE_KEY]: { legendOpen: true, view: VIEW } });
    expect(api.setState).not.toHaveBeenCalled();
  });

  it("writes a plain JSON copy of the view", () => {
    const api = memoryApi();
    const view = { viewbox: { ...VIEW.viewbox, scale: 1.5 }, userMoved: false, extra: () => 1 };
    writeShellState(api, { view });
    expect(api.state).toEqual({
      [SHELL_STATE_KEY]: { view: { viewbox: VIEW.viewbox, userMoved: false } },
    });
    expect(JSON.parse(JSON.stringify(api.state))).toEqual(api.state);
  });

  it("does not write when nothing changes", () => {
    const api = memoryApi({ [SHELL_STATE_KEY]: { legendOpen: true, view: VIEW } });
    writeShellState(api, { legendOpen: true, view: { ...VIEW, viewbox: { ...VIEW.viewbox } } });
    expect(api.setState).not.toHaveBeenCalled();
  });

  it.each([
    ["a string", "garbage"],
    ["null", null],
    ["an array", [1]],
  ])("replaces a malformed state (%s) instead of failing", (_name, state) => {
    const api = memoryApi(state);
    writeShellState(api, { legendOpen: false });
    expect(api.state).toEqual({ [SHELL_STATE_KEY]: { legendOpen: false } });
  });

  it("replaces a malformed shell part and keeps the other keys", () => {
    const api = memoryApi({ other: [1], [SHELL_STATE_KEY]: 42 });
    writeShellState(api, { legendOpen: false });
    expect(api.state).toEqual({ other: [1], [SHELL_STATE_KEY]: { legendOpen: false } });
  });
});

describe("persistView", () => {
  function fakeView(): PersistableView & { change(next: typeof VIEW | undefined): void } {
    const listeners = new Set<() => void>();
    let state: typeof VIEW | undefined;
    return {
      onChange(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      getState: () => state,
      change(next) {
        state = next;
        for (const listener of listeners) listener();
      },
    };
  }

  it("writes once the view rested for 250ms, not on every frame", () => {
    vi.useFakeTimers();
    try {
      const api = memoryApi({ other: 1 });
      const view = fakeView();
      persistView(api, view);
      for (let frame = 0; frame < 30; frame++) {
        view.change({ ...VIEW, viewbox: { ...VIEW.viewbox, x: frame } });
        vi.advanceTimersByTime(16);
      }
      expect(api.setState).not.toHaveBeenCalled();
      vi.advanceTimersByTime(250);
      expect(api.setState).toHaveBeenCalledTimes(1);
      expect(readShellState(api).view?.viewbox.x).toBe(29);
      expect((api.state as Record<string, unknown>).other).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("writes a pending change when it stops, and nothing afterwards", () => {
    vi.useFakeTimers();
    try {
      const api = memoryApi();
      const view = fakeView();
      const stop = persistView(api, view, { delayMs: 1000 });
      view.change(VIEW);
      stop();
      expect(readShellState(api).view).toEqual(VIEW);
      view.change({ ...VIEW, userMoved: false });
      vi.advanceTimersByTime(2000);
      stop();
      expect(api.setState).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaves the stored view alone while the viewport has none", () => {
    vi.useFakeTimers();
    try {
      const api = memoryApi({ [SHELL_STATE_KEY]: { view: VIEW } });
      const view = fakeView();
      persistView(api, view);
      view.change(undefined);
      vi.advanceTimersByTime(300);
      expect(readShellState(api).view).toEqual(VIEW);
    } finally {
      vi.useRealTimers();
    }
  });
});
