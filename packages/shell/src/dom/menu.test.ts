import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cleanup, installFakes, keydown, mount, pointer } from "./test-support.js";
import type { MenuGroups } from "./types.js";

beforeEach(installFakes);
afterEach(cleanup);

function groups(log: string[] = []): MenuGroups {
  let level = "big-picture";
  let captions = true;
  return {
    help: [
      {
        kind: "dialog",
        id: "shortcuts",
        label: "Keyboard shortcuts…",
        icon: "keyboard",
        onSelect: () => log.push("shortcuts"),
      },
    ],
    model: [
      {
        kind: "radio",
        id: "level",
        label: "Level",
        options: [
          { value: "big-picture", label: "Big picture" },
          { value: "process", label: "Process modelling" },
        ],
        value: () => level,
        onSelect: (value) => {
          level = value;
          log.push(`level:${value}`);
        },
      },
      {
        kind: "checkbox",
        id: "captions",
        label: "Type captions",
        checked: () => captions,
        onToggle: (checked) => {
          captions = checked;
          log.push(`captions:${checked}`);
        },
      },
    ],
    export: [
      {
        kind: "action",
        id: "png",
        label: "Export as PNG",
        icon: "file-image",
        onSelect: () => log.push("png"),
      },
      {
        kind: "action",
        id: "svg",
        label: "Export as SVG",
        icon: "file-code-corner",
        shortcut: "⌘E",
        onSelect: () => log.push("svg"),
      },
    ],
  };
}

function items(dropdown: HTMLElement): HTMLElement[] {
  return [...dropdown.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
}

function labels(dropdown: HTMLElement): string[] {
  return items(dropdown).map((item) => item.querySelector(".cd-shell-menu-item-label")?.textContent ?? "");
}

describe("menu: ARIA and structure (guide §5.4)", () => {
  it("wires the trigger to the dropdown", () => {
    const { shell } = mount({ menu: groups() });
    const { trigger, dropdown } = shell.menu;
    expect(trigger.getAttribute("aria-label")).toBe("Menu");
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-controls")).toBe(dropdown.id);
    expect(dropdown.id).toMatch(/^cd-shell-menu-\d+$/);
    expect(dropdown.getAttribute("role")).toBe("menu");
    expect(dropdown.getAttribute("aria-label")).toBe("Menu");
    expect(trigger.querySelector("svg")?.getAttribute("width")).toBe("16");
    expect(trigger.textContent).toBe("");
  });

  it("renders Model, Export and Help in that order with separators", () => {
    const { shell } = mount({ menu: groups() });
    shell.menu.open();
    const { dropdown } = shell.menu;
    expect([...dropdown.children].map((child) => child.className)).toEqual([
      "cd-shell-menu-group",
      "cd-shell-menu-item",
      "cd-shell-menu-separator",
      "cd-shell-menu-item",
      "cd-shell-menu-item",
      "cd-shell-menu-separator",
      "cd-shell-menu-item",
    ]);
    expect(labels(dropdown)).toEqual([
      "Big picture",
      "Process modelling",
      "Type captions",
      "Export as PNG",
      "Export as SVG",
      "Keyboard shortcuts…",
    ]);
    for (const separator of dropdown.querySelectorAll(".cd-shell-menu-separator")) {
      expect(separator.getAttribute("role")).toBe("separator");
    }
  });

  it("gives each entry kind its role and state", () => {
    const { shell } = mount({ menu: groups() });
    shell.menu.open();
    const { dropdown } = shell.menu;
    const group = dropdown.querySelector(".cd-shell-menu-group");
    expect(group?.getAttribute("role")).toBe("group");
    expect(group?.getAttribute("aria-label")).toBe("Level");
    expect(group?.querySelector(".cd-shell-menu-heading")?.textContent).toBe("Level");
    expect(group?.querySelector(".cd-shell-menu-heading")?.getAttribute("aria-hidden")).toBe("true");
    const [bigPicture, process, captions, png, svg, shortcuts] = items(dropdown);
    expect(bigPicture?.getAttribute("role")).toBe("menuitemradio");
    expect(bigPicture?.getAttribute("aria-checked")).toBe("true");
    expect(process?.getAttribute("aria-checked")).toBe("false");
    expect(captions?.getAttribute("role")).toBe("menuitemcheckbox");
    expect(captions?.getAttribute("aria-checked")).toBe("true");
    expect(captions?.dataset.menuId).toBe("captions");
    expect(png?.getAttribute("role")).toBe("menuitem");
    expect(png?.hasAttribute("aria-checked")).toBe(false);
    expect(svg?.querySelector(".cd-shell-menu-item-end")?.textContent).toBe("⌘E");
    expect(shortcuts?.getAttribute("aria-haspopup")).toBe("dialog");
    for (const item of items(dropdown)) expect(item.getAttribute("tabindex")).toBe("-1");
  });

  it("keeps a 16px icon column for every entry, with an icon only where given", () => {
    const { shell } = mount({ menu: groups() });
    shell.menu.open();
    const columns = items(shell.menu.dropdown).map((item) => item.firstElementChild);
    for (const column of columns) expect(column?.className).toBe("cd-shell-menu-item-icon");
    expect(columns.map((column) => column?.querySelector("svg") !== null)).toEqual([
      false,
      false,
      false,
      true,
      true,
      true,
    ]);
  });

  it("collapses empty groups with their separator", () => {
    const { shell } = mount({ menu: { model: [], export: groups().export, help: [] } });
    shell.menu.open();
    expect(shell.menu.dropdown.querySelector(".cd-shell-menu-separator")).toBeNull();
    expect(labels(shell.menu.dropdown)).toEqual(["Export as PNG", "Export as SVG"]);
  });

  it("appends the Legend checkbox to the Model group", () => {
    const onToggle = vi.fn();
    const { shell } = mount({
      menu: { export: groups().export },
      legend: { render() {}, open: false, onToggle },
    });
    shell.menu.open();
    const { dropdown } = shell.menu;
    expect(labels(dropdown)).toEqual(["Legend", "Export as PNG", "Export as SVG"]);
    const legend = items(dropdown)[0];
    expect(legend?.getAttribute("role")).toBe("menuitemcheckbox");
    expect(legend?.getAttribute("aria-checked")).toBe("false");
    legend?.click();
    expect(shell.legend?.isOpen()).toBe(true);
    expect(onToggle).toHaveBeenCalledWith(true);
    expect(shell.menu.isOpen()).toBe(true);
    expect(items(dropdown)[0]?.getAttribute("aria-checked")).toBe("true");
  });

  it("leaves the Legend entry out with menuEntry: false", () => {
    const { shell } = mount({ legend: { render() {}, menuEntry: false } });
    expect(shell.menu.trigger.hidden).toBe(true);
  });

  it("re-renders on setGroups", () => {
    const { shell } = mount({ menu: { export: groups().export } });
    shell.menu.open();
    shell.menu.setGroups({ help: groups().help });
    expect(labels(shell.menu.dropdown)).toEqual(["Keyboard shortcuts…"]);
    expect(document.activeElement).toBe(items(shell.menu.dropdown)[0]);
    shell.menu.setGroups({});
    expect(shell.menu.isOpen()).toBe(false);
    expect(shell.menu.trigger.hidden).toBe(true);
  });
});

describe("menu: keyboard", () => {
  it.each(["Enter", " ", "ArrowDown"])("%j on the trigger opens on the first entry", (key) => {
    const { shell } = mount({ menu: groups() });
    shell.menu.trigger.focus();
    const event = keydown(shell.menu.trigger, { key });
    expect(event.defaultPrevented).toBe(true);
    expect(shell.menu.isOpen()).toBe(true);
    expect(shell.menu.trigger.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(items(shell.menu.dropdown)[0]);
  });

  it("ArrowUp on the trigger opens on the last entry", () => {
    const { shell } = mount({ menu: groups() });
    keydown(shell.menu.trigger, { key: "ArrowUp" });
    expect(document.activeElement).toBe(items(shell.menu.dropdown).at(-1));
  });

  it("wraps with the arrows, jumps with Home and End and by first letter", () => {
    const { shell } = mount({ menu: groups() });
    shell.menu.open();
    const { dropdown } = shell.menu;
    const all = items(dropdown);
    const press = (key: string) => keydown(document.activeElement ?? dropdown, { key });
    expect(press("ArrowUp").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(all.at(-1));
    press("ArrowDown");
    expect(document.activeElement).toBe(all[0]);
    press("ArrowDown");
    expect(document.activeElement).toBe(all[1]);
    press("End");
    expect(document.activeElement).toBe(all.at(-1));
    press("Home");
    expect(document.activeElement).toBe(all[0]);
    press("e");
    expect(document.activeElement).toBe(all[3]);
    press("E");
    expect(document.activeElement).toBe(all[4]);
    press("e");
    expect(document.activeElement).toBe(all[3]);
    press("k");
    expect(document.activeElement).toBe(all[5]);
    expect(press("z").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(all[5]);
  });

  it("Escape closes and returns the focus to the trigger", () => {
    const { shell } = mount({ menu: groups() });
    shell.menu.open();
    const event = keydown(document.activeElement!, { key: "Escape" });
    expect(event.defaultPrevented).toBe(true);
    expect(shell.menu.isOpen()).toBe(false);
    expect(shell.menu.trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(shell.menu.trigger);
  });

  it("Tab closes from the trigger, so the browser moves on to the palette", () => {
    const { shell } = mount({ menu: groups() });
    shell.menu.open();
    const event = keydown(document.activeElement!, { key: "Tab" });
    expect(event.defaultPrevented).toBe(false);
    expect(shell.menu.isOpen()).toBe(false);
    expect(document.activeElement).toBe(shell.menu.trigger);
  });

  it("disabled entries stay focusable but do nothing", () => {
    const onSelect = vi.fn();
    const { shell } = mount({
      menu: {
        export: [{ kind: "action", id: "png", label: "Export as PNG", disabled: () => true, onSelect }],
      },
    });
    shell.menu.open();
    const [png] = items(shell.menu.dropdown);
    expect(png?.getAttribute("aria-disabled")).toBe("true");
    expect(document.activeElement).toBe(png);
    png?.click();
    expect(onSelect).not.toHaveBeenCalled();
    expect(shell.menu.isOpen()).toBe(true);
  });
});

describe("menu: activation", () => {
  it.each(["png", "shortcuts"])("%s closes the menu and focuses the trigger before onSelect", (id) => {
    const seen: { open: boolean; focus: Element | null }[] = [];
    const menu = groups();
    const entry = [...(menu.export ?? []), ...(menu.help ?? [])].find((candidate) => candidate.id === id);
    if (!entry || (entry.kind !== "action" && entry.kind !== "dialog")) throw new Error("fixture");
    const { shell } = mount({
      menu: {
        [id === "png" ? "export" : "help"]: [
          {
            ...entry,
            onSelect: () => seen.push({ open: shell.menu.isOpen(), focus: document.activeElement }),
          },
        ],
      },
    });
    shell.menu.open();
    items(shell.menu.dropdown)[0]?.click();
    expect(seen).toEqual([{ open: false, focus: shell.menu.trigger }]);
  });

  it("checkbox and radio toggle, stay open and keep the focus", () => {
    const log: string[] = [];
    const { shell } = mount({ menu: groups(log) });
    shell.menu.open();
    items(shell.menu.dropdown)[2]?.focus();
    items(shell.menu.dropdown)[2]?.click();
    expect(log).toEqual(["captions:false"]);
    expect(shell.menu.isOpen()).toBe(true);
    expect(items(shell.menu.dropdown)[2]?.getAttribute("aria-checked")).toBe("false");
    expect(document.activeElement).toBe(items(shell.menu.dropdown)[2]);

    items(shell.menu.dropdown)[1]?.click();
    items(shell.menu.dropdown)[1]?.click();
    expect(log).toEqual(["captions:false", "level:process"]);
    expect(
      items(shell.menu.dropdown)
        .map((item) => item.getAttribute("aria-checked"))
        .slice(0, 2),
    ).toEqual(["false", "true"]);
  });

  it("re-reads checked, value and disabled on open and on refresh", () => {
    let checked = false;
    let disabled = false;
    const { shell } = mount({
      menu: {
        model: [
          {
            kind: "checkbox",
            id: "snap",
            label: "Snap",
            checked: () => checked,
            disabled: () => disabled,
            onToggle() {},
          },
        ],
      },
    });
    shell.menu.open();
    const item = () => items(shell.menu.dropdown)[0];
    expect(item()?.getAttribute("aria-checked")).toBe("false");
    checked = true;
    disabled = true;
    expect(item()?.getAttribute("aria-checked")).toBe("false");
    shell.menu.refresh();
    expect(item()?.getAttribute("aria-checked")).toBe("true");
    expect(item()?.getAttribute("aria-disabled")).toBe("true");
    expect(document.activeElement).toBe(item());
  });

  it("read-only disables every Model entry including the Legend toggle, the rest stay", () => {
    const { shell } = mount({ menu: groups(), legend: { render() {}, open: true } });
    shell.setReadOnly(true);
    shell.menu.open();
    const disabled = items(shell.menu.dropdown).map((item) => item.getAttribute("aria-disabled") === "true");
    expect(disabled).toEqual([true, true, true, true, false, false, false]);
    shell.setReadOnly(false);
    expect(items(shell.menu.dropdown).some((item) => item.hasAttribute("aria-disabled"))).toBe(false);
  });
});

describe("menu: pointer", () => {
  it("toggles on trigger clicks", () => {
    const { shell } = mount({ menu: groups() });
    shell.menu.trigger.click();
    expect(shell.menu.isOpen()).toBe(true);
    pointer(shell.menu.trigger, "pointerdown");
    shell.menu.trigger.click();
    expect(shell.menu.isOpen()).toBe(false);
  });

  it("closes on a pointerdown outside in the capture phase, without stopping or moving focus", () => {
    const { shell, root } = mount({ menu: groups() });
    const tool = document.createElement("div");
    root.querySelector(".cd-shell-canvas")?.append(tool);
    const reached = vi.fn((event: Event) => event.stopPropagation());
    tool.addEventListener("pointerdown", reached);
    shell.menu.open();
    const focused = document.activeElement;
    const event = pointer(tool, "pointerdown");
    expect(shell.menu.isOpen()).toBe(false);
    expect(reached).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(focused);
  });

  it("ignores pointerdowns inside the dropdown", () => {
    const { shell } = mount({ menu: groups() });
    shell.menu.open();
    pointer(items(shell.menu.dropdown)[0]!, "pointerdown");
    expect(shell.menu.isOpen()).toBe(true);
  });

  it("close() keeps the focus unless restoreFocus", () => {
    const { shell } = mount({ menu: groups() });
    shell.menu.open("last");
    const focused = document.activeElement;
    shell.menu.close();
    expect(document.activeElement).toBe(focused);
    shell.menu.open();
    shell.menu.close({ restoreFocus: true });
    expect(document.activeElement).toBe(shell.menu.trigger);
  });
});
