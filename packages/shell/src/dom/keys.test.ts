import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cleanup, fakeZoomTarget, installFakes, keydown, mount } from "../../test/support/dom.js";

beforeEach(installFakes);
afterEach(cleanup);

const HANDLED = [
  { key: "=", code: "Equal", metaKey: true },
  { key: "+", code: "Equal", metaKey: true, shiftKey: true },
  { key: "+", code: "NumpadAdd", ctrlKey: true },
  { key: "-", code: "Minus", ctrlKey: true },
  { key: "_", code: "Minus", metaKey: true, shiftKey: true },
  { key: "-", code: "NumpadSubtract", metaKey: true },
  { key: "0", code: "Digit0", metaKey: true },
  { key: "Insert", code: "Numpad0", ctrlKey: true },
  { key: "!", code: "Digit1", shiftKey: true },
];

function windowSpy() {
  const seen: string[] = [];
  const listener = (event: KeyboardEvent) => seen.push(`${event.key}/${event.code}`);
  window.addEventListener("keydown", listener);
  return { seen, dispose: () => window.removeEventListener("keydown", listener) };
}

describe("the one keydown listener", () => {
  it("ide: every chrome key acts exactly once and never reaches window", () => {
    const { shell } = mount({ host: "ide" });
    const target = fakeZoomTarget(1.5);
    shell.setZoomTarget(target);
    const spy = windowSpy();
    for (const init of HANDLED) {
      expect(keydown(document.body, init).defaultPrevented, init.code).toBe(true);
    }
    spy.dispose();
    expect(spy.seen).toEqual([]);
    expect(target.calls).toEqual([
      "step:1",
      "step:1",
      "step:1",
      "step:-1",
      "step:-1",
      "step:-1",
      "actual",
      "actual",
      "fit",
    ]);
  });

  it("ide: Escape with the open menu closes it and stays in the webview", () => {
    const { shell } = mount({
      host: "ide",
      menu: { export: [{ kind: "action", id: "png", label: "Export as PNG", onSelect() {} }] },
    });
    shell.menu.open();
    const spy = windowSpy();
    const event = keydown(document.activeElement!, { key: "Escape", code: "Escape" });
    spy.dispose();
    expect(event.defaultPrevented).toBe(true);
    expect(shell.menu.isOpen()).toBe(false);
    expect(spy.seen).toEqual([]);
  });

  it("ide: keys the canvas handled and undo in text fields stop, the rest goes on to VS Code", () => {
    const { root } = mount({ host: "ide" });
    const svg = root.querySelector(".cd-shell-canvas")!.appendChild(document.createElement("div"));
    svg.addEventListener("keydown", (event) => {
      if (event.key === "a") event.preventDefault();
    });
    const input = root.appendChild(document.createElement("input"));
    const spy = windowSpy();
    keydown(svg, { key: "a", code: "KeyA", metaKey: true });
    const undo = keydown(input, { key: "z", code: "KeyZ", metaKey: true });
    keydown(input, { key: "=", code: "Equal", metaKey: true });
    keydown(input, { key: "!", code: "Digit1", shiftKey: true });
    keydown(svg, { key: "s", code: "KeyS", metaKey: true });
    keydown(svg, { key: "=", code: "Equal" });
    spy.dispose();
    expect(undo.defaultPrevented).toBe(false);
    expect(spy.seen).toEqual(["!/Digit1", "s/KeyS", "=/Equal"]);
  });

  it("does not zoom in text fields, while composing or with a modal dialog", () => {
    const { shell, root } = mount({ host: "web" });
    const target = fakeZoomTarget(0.5);
    shell.setZoomTarget(target);
    const editable = root.appendChild(document.createElement("div"));
    editable.contentEditable = "true";
    expect(keydown(editable, { key: "=", code: "Equal", metaKey: true }).defaultPrevented).toBe(false);
    expect(
      keydown(document.body, { key: "=", code: "Equal", metaKey: true, isComposing: true }).defaultPrevented,
    ).toBe(false);
    const dialog = root.appendChild(document.createElement("div"));
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    expect(keydown(document.body, { key: "0", code: "Digit0", ctrlKey: true }).defaultPrevented).toBe(false);
    dialog.hidden = true;
    expect(keydown(document.body, { key: "0", code: "Digit0", ctrlKey: true }).defaultPrevented).toBe(true);
    expect(target.calls).toEqual(["actual"]);
  });

  it("web: zoom keys zoom the diagram, not the page, and still reach window", () => {
    const { shell } = mount({ host: "web" });
    const target = fakeZoomTarget(1);
    shell.setZoomTarget(target);
    const spy = windowSpy();
    const event = keydown(document.body, { key: "-", code: "Minus", ctrlKey: true });
    spy.dispose();
    expect(event.defaultPrevented).toBe(true);
    expect(spy.seen).toEqual(["-/Minus"]);
    expect(target.calls).toEqual(["step:-1"]);
  });

  it("zoom out never zooms in below 20 %", () => {
    const { shell } = mount();
    const target = fakeZoomTarget(0.15);
    shell.setZoomTarget(target);
    expect(keydown(document.body, { key: "-", code: "Minus", metaKey: true }).defaultPrevented).toBe(true);
    expect(target.calls).toEqual([]);
  });

  it("embedded: listens on the root only, so keys outside the modeler stay the page's", () => {
    const { shell, root } = mount({ host: "embedded" });
    const target = fakeZoomTarget(1);
    shell.setZoomTarget(target);
    const outside = document.body.appendChild(document.createElement("button"));
    expect(keydown(outside, { key: "=", code: "Equal", metaKey: true }).defaultPrevented).toBe(false);
    expect(
      keydown(root.querySelector(".cd-shell-canvas")!, { key: "=", code: "Equal", metaKey: true })
        .defaultPrevented,
    ).toBe(true);
    expect(target.calls).toEqual(["step:1"]);
  });

  it("keyScope overrides the host default", () => {
    const { shell } = mount({ host: "embedded", keyScope: "document" });
    const target = fakeZoomTarget(1);
    shell.setZoomTarget(target);
    keydown(document.body, { key: "!", code: "Digit1", shiftKey: true });
    expect(target.calls).toEqual(["fit"]);
  });

  it("installs exactly one keydown listener on its target", () => {
    const add = vi.spyOn(document, "addEventListener");
    mount({
      host: "ide",
      menu: { export: [{ kind: "action", id: "png", label: "Export as PNG", onSelect() {} }] },
    });
    expect(add.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(1);
    expect(add.mock.calls.find(([type]) => type === "keydown")?.[2]).toBeUndefined();
  });
});

describe("dialogs a modeler hides through CSS", () => {
  it("count as closed: zoom keys act again", () => {
    const { shell } = mount();
    const target = fakeZoomTarget(1);
    shell.setZoomTarget(target);
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    document.body.append(dialog);
    keydown(document.body, { key: "=", code: "Equal", metaKey: true });
    expect(target.calls).toEqual([]);
    dialog.style.display = "none";
    keydown(document.body, { key: "=", code: "Equal", metaKey: true });
    expect(target.calls).toEqual(["step:1"]);
  });
});
