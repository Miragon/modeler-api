import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Appearance, Theme } from "../../core/index.js";
import {
  APPEARANCE_MESSAGE_TYPE,
  appearanceMessage,
  applyAppearance,
  connectAppearance,
  connectReducedMotion,
} from "./index.js";

const NO_TRANSITION = "cd-shell-no-transition";

let frames: FrameRequestCallback[] = [];

function runFrame(): void {
  const due = frames;
  frames = [];
  for (const callback of due) callback(performance.now());
}

async function flushObservers(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function post(data: unknown): void {
  window.dispatchEvent(new MessageEvent("message", { data }));
}

function shown(element: Element = document.documentElement) {
  return {
    theme: element.getAttribute("data-cd-theme"),
    kontrast: element.getAttribute("data-cd-kontrast"),
  };
}

function setBodyClasses(...classes: string[]): void {
  document.body.className = classes.join(" ");
}

beforeEach(() => {
  frames = [];
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => frames.push(callback)),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  const html = document.documentElement;
  html.removeAttribute("data-cd-theme");
  html.removeAttribute("data-cd-kontrast");
  html.classList.remove(NO_TRANSITION);
  document.body.className = "";
  document.body.innerHTML = "";
});

describe("applyAppearance", () => {
  it("sets data-cd-theme and data-cd-kontrast on <html> in the same task", () => {
    applyAppearance({ theme: "dark", kontrast: "hoch" });
    expect(shown()).toEqual({ theme: "dark", kontrast: "hoch" });
  });

  it("delivers both attribute changes in one mutation batch", async () => {
    const batches: string[][] = [];
    const observer = new MutationObserver((records) =>
      batches.push(records.map((record) => record.attributeName ?? "")),
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-cd-theme", "data-cd-kontrast"],
    });

    applyAppearance({ theme: "light", kontrast: "hoch" });
    await flushObservers();
    observer.disconnect();

    expect(batches).toEqual([["data-cd-theme", "data-cd-kontrast"]]);
  });

  it("removes data-cd-kontrast when the appearance has none", () => {
    applyAppearance({ theme: "light", kontrast: "hoch" });
    applyAppearance({ theme: "light" });
    expect(shown()).toEqual({ theme: "light", kontrast: null });
  });

  it("suppresses transitions on <html> until the second frame", () => {
    const html = document.documentElement;
    applyAppearance({ theme: "dark" });
    expect(html.classList.contains(NO_TRANSITION)).toBe(true);

    runFrame();
    expect(html.classList.contains(NO_TRANSITION)).toBe(true);

    runFrame();
    expect(html.classList.contains(NO_TRANSITION)).toBe(false);
    expect(frames).toEqual([]);
  });

  it("keeps the transition stop until two frames after the last of several quick switches", () => {
    const html = document.documentElement;
    applyAppearance({ theme: "dark" });
    runFrame();
    applyAppearance({ theme: "light" });

    runFrame();
    expect(html.classList.contains(NO_TRANSITION)).toBe(true);

    runFrame();
    expect(html.classList.contains(NO_TRANSITION)).toBe(false);
    expect(shown()).toEqual({ theme: "light", kontrast: null });
  });

  it("writes on a given container and still stops transitions on <html>", () => {
    const container = document.createElement("div");
    document.body.append(container);

    applyAppearance({ theme: "dark", kontrast: "hoch" }, container);

    expect(shown(container)).toEqual({ theme: "dark", kontrast: "hoch" });
    expect(shown()).toEqual({ theme: null, kontrast: null });
    expect(document.documentElement.classList.contains(NO_TRANSITION)).toBe(true);
    runFrame();
    runFrame();
    expect(document.documentElement.classList.contains(NO_TRANSITION)).toBe(false);
  });
});

describe("connectAppearance", () => {
  const lightAndDark: readonly Theme[] = ["light", "dark"];
  const lightOnly: readonly Theme[] = ["light"];
  let disconnect: (() => void) | undefined;

  function connect(themes: readonly Theme[], initial?: Appearance): void {
    if (initial) {
      applyAppearance(initial);
      runFrame();
      runFrame();
    }
    disconnect = connectAppearance({ themes });
  }

  afterEach(() => {
    disconnect?.();
    disconnect = undefined;
  });

  it("applies every appearance message", () => {
    connect(lightAndDark, { theme: "light" });

    post(appearanceMessage({ theme: "dark" }));
    expect(shown()).toEqual({ theme: "dark", kontrast: null });

    post(appearanceMessage({ theme: "light", kontrast: "hoch" }));
    expect(shown()).toEqual({ theme: "light", kontrast: "hoch" });
  });

  it("resolves messages against the webview's themes: never half-dark", () => {
    connect(lightOnly, { theme: "light" });

    post(appearanceMessage({ theme: "dark", kontrast: "hoch" }));

    expect(shown()).toEqual({ theme: "light", kontrast: "hoch" });
  });

  it("does not touch <html> for a message that changes nothing", () => {
    connect(lightAndDark, { theme: "dark" });

    post(appearanceMessage({ theme: "dark" }));

    expect(document.documentElement.classList.contains(NO_TRANSITION)).toBe(false);
  });

  it.each([
    ["a command message", { type: "command", name: "fitView" }],
    ["a string", APPEARANCE_MESSAGE_TYPE],
    ["null", null],
    ["a malformed appearance", { type: APPEARANCE_MESSAGE_TYPE, appearance: { theme: "system" } }],
  ])("ignores %s", async (_name, data) => {
    connect(lightAndDark);

    post(data);
    expect(shown()).toEqual({ theme: null, kontrast: null });

    setBodyClasses("vscode-dark");
    await flushObservers();
    expect(shown()).toEqual({ theme: "dark", kontrast: null });
  });

  it("follows the VS Code body classes until the first message (no attributes from the HTML)", async () => {
    connect(lightAndDark);

    setBodyClasses("vscode-dark");
    await flushObservers();
    expect(shown()).toEqual({ theme: "dark", kontrast: null });

    setBodyClasses("vscode-high-contrast");
    await flushObservers();
    expect(shown()).toEqual({ theme: "dark", kontrast: "hoch" });

    setBodyClasses("vscode-light");
    await flushObservers();
    expect(shown()).toEqual({ theme: "light", kontrast: null });
  });

  it("reads High Contrast Light before High Contrast", async () => {
    connect(lightAndDark);

    setBodyClasses("vscode-high-contrast", "vscode-high-contrast-light");
    await flushObservers();

    expect(shown()).toEqual({ theme: "light", kontrast: "hoch" });
  });

  it("resolves the body classes against the themes", async () => {
    connect(lightOnly);

    setBodyClasses("vscode-dark");
    await flushObservers();
    expect(shown()).toEqual({ theme: "light", kontrast: null });

    setBodyClasses("vscode-high-contrast");
    await flushObservers();
    expect(shown()).toEqual({ theme: "light", kontrast: "hoch" });
  });

  it("ignores the body classes once a message arrived (the setting may override them)", async () => {
    connect(lightAndDark);

    post(appearanceMessage({ theme: "dark" }));
    setBodyClasses("vscode-light");
    await flushObservers();

    expect(shown()).toEqual({ theme: "dark", kontrast: null });
  });

  it("keeps the attributes from the HTML at connect time", () => {
    setBodyClasses("vscode-light");
    connect(lightAndDark, { theme: "dark" });

    expect(shown()).toEqual({ theme: "dark", kontrast: null });
  });

  it("with the attributes from the HTML, only the bridge switches (no flash of the setting-less mode)", async () => {
    // a dark-capable modeler, colorTheme "dark" under VS Code Light: the extension rendered dark
    setBodyClasses("vscode-light");
    connect(lightAndDark, { theme: "dark" });
    const batches: Array<string | null> = [];
    const observer = new MutationObserver(() => batches.push(shown().theme));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-cd-theme"],
    });

    // VS Code switches to Dark+: the body classes change before the bridge's message arrives
    setBodyClasses("vscode-dark");
    await flushObservers();
    setBodyClasses("vscode-light");
    await flushObservers();
    expect(shown()).toEqual({ theme: "dark", kontrast: null });

    post(appearanceMessage({ theme: "light" }));
    await flushObservers();
    observer.disconnect();
    expect(batches).toEqual(["light"]);
  });

  it("applies the body classes at once when <html> has no appearance yet", () => {
    setBodyClasses("vscode-high-contrast");
    connect(lightOnly);

    expect(shown()).toEqual({ theme: "light", kontrast: "hoch" });
  });

  it("leaves <html> alone without VS Code body classes", async () => {
    connect(lightAndDark);
    setBodyClasses("modeler-ready");
    await flushObservers();

    expect(shown()).toEqual({ theme: null, kontrast: null });
  });

  it("starts the fallback once the body exists", async () => {
    const body = document.body;
    body.remove();
    connect(lightAndDark);
    document.documentElement.append(body);
    document.dispatchEvent(new Event("DOMContentLoaded"));

    setBodyClasses("vscode-dark");
    await flushObservers();

    expect(shown()).toEqual({ theme: "dark", kontrast: null });
  });

  it("removes the message listener and the observer on disconnect", async () => {
    const addEventListener = vi.spyOn(window, "addEventListener");
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    connect(lightAndDark, { theme: "light" });
    const listener = addEventListener.mock.calls.find(([type]) => type === "message")?.[1];

    disconnect?.();
    disconnect = undefined;

    expect(removeEventListener).toHaveBeenCalledWith("message", listener);
    post(appearanceMessage({ theme: "dark" }));
    setBodyClasses("vscode-dark");
    await flushObservers();
    expect(shown()).toEqual({ theme: "light", kontrast: null });
    vi.restoreAllMocks();
  });

  it("throws without themes", () => {
    expect(() => connectAppearance({ themes: [] })).toThrow(/at least one theme/);
  });
});

describe("connectReducedMotion", () => {
  const CLASS = "cd-shell-reduce-motion";

  it("mirrors VS Code's vscode-reduce-motion body class on <html> for the whole session", async () => {
    setBodyClasses("vscode-light", "vscode-reduce-motion");
    const disconnect = connectReducedMotion();
    expect(document.documentElement.classList.contains(CLASS)).toBe(true);

    setBodyClasses("vscode-light");
    await flushObservers();
    expect(document.documentElement.classList.contains(CLASS)).toBe(false);

    setBodyClasses("vscode-dark", "vscode-reduce-motion");
    await flushObservers();
    expect(document.documentElement.classList.contains(CLASS)).toBe(true);

    disconnect();
    expect(document.documentElement.classList.contains(CLASS)).toBe(false);
    setBodyClasses("vscode-reduce-motion");
    await flushObservers();
    expect(document.documentElement.classList.contains(CLASS)).toBe(false);
  });
});
