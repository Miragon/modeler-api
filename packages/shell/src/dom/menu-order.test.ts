import { afterEach, describe, expect, it } from "vitest";

import { defaultMessages } from "../core/index.js";
import { createMenu, type MenuGroupName } from "./menu.js";
import { createTooltip } from "./tooltip.js";
import type { MenuEntry } from "./types.js";

afterEach(() => {
  document.body.replaceChildren();
});

function action(id: string): MenuEntry {
  return { kind: "action", id, label: id, onSelect() {} };
}

function menuWith(shellEntries: Partial<Record<MenuGroupName, readonly MenuEntry[]>>) {
  const root = document.createElement("div");
  const layer = document.createElement("div");
  root.append(layer);
  document.body.append(root);
  const tooltip = createTooltip({ root, layer, id: "tooltip" });
  return createMenu({
    root,
    layer,
    id: "menu",
    messages: defaultMessages,
    tooltip,
    groups: { model: [action("level")], export: [action("png")], help: [action("shortcuts")] },
    shellEntries: (group) => shellEntries[group] ?? [],
    isReadOnly: () => true,
  });
}

function rendered(dropdown: HTMLElement): string[] {
  return [...dropdown.children].map((child) =>
    child.getAttribute("role") === "separator"
      ? "|"
      : `${child.getAttribute("data-menu-group")}:${child.getAttribute("data-menu-id")}`,
  );
}

describe("menu groups (guide §5.4)", () => {
  it("render File, Model, Export, Appearance and Help in this order, separated", () => {
    const menu = menuWith({
      file: [action("new-diagram"), action("open")],
      model: [action("legend")],
      appearance: [action("appearance")],
    });
    menu.open();
    expect(rendered(menu.dropdown)).toEqual([
      "file:new-diagram",
      "file:open",
      "|",
      "model:level",
      "model:legend",
      "|",
      "export:png",
      "|",
      "appearance:appearance",
      "|",
      "help:shortcuts",
    ]);
  });

  it("collapse the shell's groups without entries, separators included", () => {
    const menu = menuWith({});
    menu.open();
    expect(rendered(menu.dropdown)).toEqual(["model:level", "|", "export:png", "|", "help:shortcuts"]);
  });

  it("lock only Model entries on a read-only canvas, never File and Appearance", () => {
    const menu = menuWith({ file: [action("open")], appearance: [action("appearance")] });
    menu.open();
    const disabled = [...menu.dropdown.querySelectorAll("[data-menu-id]")]
      .filter((item) => item.getAttribute("aria-disabled") === "true")
      .map((item) => item.getAttribute("data-menu-id"));
    expect(disabled).toEqual(["level"]);
  });
});
