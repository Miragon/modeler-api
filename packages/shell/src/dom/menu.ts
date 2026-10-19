import { ariaKeyShortcutsFromLabel, matchChromeKey, type ShellMessages } from "../core/index.js";
import { createElement, toggleAttribute } from "./element.js";
import { iconElement, type ShellIconName } from "./icons.js";
import type { TooltipController } from "./tooltip.js";
import type { MenuCheckboxEntry, MenuEntry, MenuGroups, MenuHandle, MenuRadioGroup } from "./types.js";

type GroupName = keyof MenuGroups;
const GROUP_ORDER: readonly GroupName[] = ["model", "export", "help"];

interface Item {
  /** Stable across renders, so a re-render keeps the focus on the same entry. */
  key: string;
  element: HTMLButtonElement;
  label: string;
  disabled: boolean;
  activate(): void;
}

export interface MenuContext {
  root: HTMLElement;
  layer: HTMLElement;
  id: string;
  messages: ShellMessages;
  tooltip: TooltipController;
  groups: MenuGroups;
  /** Entries the shell appends to the Model group (the Legend checkbox). */
  shellModelEntries(): readonly MenuCheckboxEntry[];
  isReadOnly(): boolean;
}

export interface MenuController extends MenuHandle {
  destroy(): void;
}

function isPrintable(event: KeyboardEvent): boolean {
  return event.key.length === 1 && /\S/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey;
}

export function createMenu(context: MenuContext): MenuController {
  const { root, layer, id, messages, tooltip } = context;
  const ownerDocument = root.ownerDocument;
  let groups = context.groups;
  let items: Item[] = [];
  let destroyed = false;

  const trigger = createElement(ownerDocument, "button", {
    type: "button",
    class: "cd-shell-menu-trigger cd-shell-island",
    "data-chrome": "menu",
    "aria-label": messages.menu,
    "aria-haspopup": "menu",
    "aria-expanded": "false",
    "aria-controls": id,
  });
  trigger.append(iconElement("menu"));

  const dropdown = createElement(ownerDocument, "div", {
    class: "cd-shell-menu",
    id,
    role: "menu",
    "aria-label": messages.menu,
  });
  dropdown.hidden = true;
  layer.prepend(dropdown);

  const isOpen = (): boolean => !dropdown.hidden;

  function entriesOf(name: GroupName): readonly MenuEntry[] {
    const own = groups[name] ?? [];
    return name === "model" ? [...own, ...context.shellModelEntries()] : own;
  }

  function hasEntries(): boolean {
    return GROUP_ORDER.some((name) => entriesOf(name).length > 0);
  }

  function updateTriggerVisibility(): void {
    trigger.hidden = !hasEntries();
    if (trigger.hidden) close();
  }

  // Guide §13.5: on a read-only canvas the Model entries that change the document are aria-disabled.
  // View-only toggles (the shell's Legend, a modeler's Type captions) opt out and stay usable.
  function isDisabled(entry: MenuEntry, group: GroupName): boolean {
    if (group === "model" && context.isReadOnly() && entry.keepEnabledWhenReadOnly !== true) return true;
    return entry.disabled?.() ?? false;
  }

  function itemElement(
    role: "menuitem" | "menuitemcheckbox" | "menuitemradio",
    label: string,
    options: {
      icon?: ShellIconName | undefined;
      end?: Node | undefined;
      disabled: boolean;
      checked?: boolean;
    },
  ): HTMLButtonElement {
    const iconSlot = createElement(ownerDocument, "span", { class: "cd-shell-menu-item-icon" });
    if (options.icon) iconSlot.append(iconElement(options.icon));
    const element = createElement(
      ownerDocument,
      "button",
      { type: "button", class: "cd-shell-menu-item", role, tabindex: "-1" },
      iconSlot,
      createElement(ownerDocument, "span", { class: "cd-shell-menu-item-label" }, label),
      options.end && createElement(ownerDocument, "span", { class: "cd-shell-menu-item-end" }, options.end),
    );
    toggleAttribute(element, "aria-disabled", options.disabled && "true");
    if (options.checked !== undefined) element.setAttribute("aria-checked", String(options.checked));
    return element;
  }

  function checkMark(): SVGSVGElement {
    return iconElement("check", { className: "cd-shell-menu-check" });
  }

  function renderEntry(entry: Exclude<MenuEntry, MenuRadioGroup>, group: GroupName): Item {
    const disabled = isDisabled(entry, group);
    if (entry.kind === "checkbox") {
      const checked = entry.checked();
      const element = itemElement("menuitemcheckbox", entry.label, {
        icon: entry.icon,
        end: checkMark(),
        disabled,
        checked,
      });
      element.dataset.menuId = entry.id;
      return {
        key: entry.id,
        element,
        label: entry.label,
        disabled,
        activate() {
          entry.onToggle(!entry.checked());
          refresh();
        },
      };
    }
    const shortcut =
      entry.kind === "action" && entry.shortcut
        ? createElement(ownerDocument, "span", { class: "cd-shell-menu-shortcut" }, entry.shortcut)
        : undefined;
    const element = itemElement("menuitem", entry.label, { icon: entry.icon, end: shortcut, disabled });
    element.dataset.menuId = entry.id;
    if (entry.kind === "action") {
      const keyShortcuts =
        entry.ariaKeyShortcuts ?? (entry.shortcut ? ariaKeyShortcutsFromLabel(entry.shortcut) : undefined);
      toggleAttribute(element, "aria-keyshortcuts", keyShortcuts || null);
    }
    if (entry.kind === "dialog") element.setAttribute("aria-haspopup", "dialog");
    if (entry.kind === "action" && entry.danger) element.dataset.danger = "";
    return {
      key: entry.id,
      element,
      label: entry.label,
      disabled,
      activate() {
        close({ restoreFocus: true });
        entry.onSelect();
      },
    };
  }

  function renderRadioGroup(
    entry: MenuRadioGroup,
    group: GroupName,
  ): { element: HTMLElement; items: Item[] } {
    const disabled = isDisabled(entry, group);
    const value = entry.value();
    const container = createElement(
      ownerDocument,
      "div",
      { class: "cd-shell-menu-group", role: "group", "aria-label": entry.label, "data-menu-id": entry.id },
      // The group's aria-label carries the heading; a menu holds no loose text.
      createElement(
        ownerDocument,
        "div",
        { class: "cd-shell-menu-heading", "aria-hidden": "true" },
        entry.label,
      ),
    );
    const radioItems = entry.options.map((option): Item => {
      const element = itemElement("menuitemradio", option.label, {
        end: checkMark(),
        disabled,
        checked: option.value === value,
      });
      element.dataset.menuValue = option.value;
      container.append(element);
      return {
        key: `${entry.id}\u0000${option.value}`,
        element,
        label: option.label,
        disabled,
        activate() {
          if (entry.value() !== option.value) entry.onSelect(option.value);
          refresh();
        },
      };
    });
    return { element: container, items: radioItems };
  }

  function render(): void {
    const focusedKey = items.find((item) => item.element === ownerDocument.activeElement)?.key;
    const nodes: HTMLElement[] = [];
    const rendered: Item[] = [];
    for (const name of GROUP_ORDER) {
      const entries = entriesOf(name);
      if (entries.length === 0) continue;
      if (nodes.length > 0) {
        nodes.push(
          createElement(ownerDocument, "div", { class: "cd-shell-menu-separator", role: "separator" }),
        );
      }
      for (const entry of entries) {
        if (entry.kind === "radio") {
          const radio = renderRadioGroup(entry, name);
          nodes.push(radio.element);
          rendered.push(...radio.items);
        } else {
          const item = renderEntry(entry, name);
          nodes.push(item.element);
          rendered.push(item);
        }
      }
    }
    for (const item of rendered) {
      item.element.addEventListener("click", () => {
        if (!item.disabled) item.activate();
      });
    }
    dropdown.replaceChildren(...nodes);
    items = rendered;
    if (focusedKey !== undefined && isOpen()) {
      (items.find((item) => item.key === focusedKey) ?? items[0])?.element.focus();
    }
  }

  function focusAt(index: number): void {
    if (items.length === 0) return;
    items[(index + items.length) % items.length]?.element.focus();
  }

  function currentIndex(): number {
    return items.findIndex((item) => item.element === ownerDocument.activeElement);
  }

  function typeAhead(character: string): void {
    const start = currentIndex();
    const lower = character.toLowerCase();
    for (let step = 1; step <= items.length; step++) {
      const index = (Math.max(start, -1) + step) % items.length;
      if (items[index]?.label.toLowerCase().startsWith(lower)) {
        focusAt(index);
        return;
      }
    }
  }

  const onOutsidePointerDown = (event: PointerEvent): void => {
    const target = event.target as Node | null;
    if (target && (dropdown.contains(target) || trigger.contains(target))) return;
    close();
  };

  // The focus left the document (a click into the VS Code workbench, another iframe): from the
  // user's view a click outside, so the menu closes without moving the focus (guide §5.4).
  const onWindowBlur = (): void => close();

  function open(focus: "first" | "last" = "first"): void {
    if (destroyed || !hasEntries()) return;
    tooltip.hide();
    const wasOpen = isOpen();
    render();
    if (!wasOpen) {
      dropdown.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      // Capture phase: diagram-js stops pointer events on palette, context pad and canvas.
      ownerDocument.addEventListener("pointerdown", onOutsidePointerDown, true);
      ownerDocument.defaultView?.addEventListener("blur", onWindowBlur);
    }
    focusAt(focus === "last" ? items.length - 1 : 0);
  }

  function close(options: { restoreFocus?: boolean } = {}): void {
    if (!isOpen()) return;
    dropdown.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    ownerDocument.removeEventListener("pointerdown", onOutsidePointerDown, true);
    ownerDocument.defaultView?.removeEventListener("blur", onWindowBlur);
    if (options.restoreFocus && !trigger.hidden) trigger.focus();
  }

  function refresh(): void {
    if (isOpen()) render();
  }

  trigger.addEventListener("click", () => {
    if (isOpen()) close();
    else open("first");
  });

  // Keys the menu consumes stop here, in every host like the palette's: a modeler's keyboard on
  // document (Event Storming moves the selection on ↑/↓, deletes it on Delete, creates a sticky on
  // E) must never act on them, and VS Code never sees them.
  function consume(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  trigger.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
      consume(event);
      open("first");
    } else if (event.key === "ArrowUp") {
      consume(event);
      open("last");
    }
  });

  dropdown.addEventListener("keydown", (event) => {
    // Zoom and fit keys still act with the menu open; the shell's key listener runs them.
    if (matchChromeKey(event)) return;
    switch (event.key) {
      case "ArrowDown":
        focusAt(currentIndex() + 1);
        break;
      case "ArrowUp": {
        const index = currentIndex();
        focusAt(index < 0 ? items.length - 1 : index - 1);
        break;
      }
      case "Home":
        focusAt(0);
        break;
      case "End":
        focusAt(items.length - 1);
        break;
      case "Tab":
        // The browser's Tab runs after this handler from wherever the focus is then: from the
        // trigger it moves on to the palette instead of leaving the shell from the layer.
        close({ restoreFocus: true });
        return;
      case "Escape":
        // The shell's key listener closes the menu (and keeps Escape from VS Code in the IDE host).
        return;
      case "Enter":
      case " ":
      case "Delete":
      case "Backspace":
        // The entry's native click handles Enter and Space; nothing else may act on these keys.
        event.stopPropagation();
        return;
      default:
        if (!isPrintable(event)) return;
        typeAhead(event.key);
    }
    consume(event);
  });

  updateTriggerVisibility();

  return {
    trigger,
    dropdown,
    isOpen,
    open,
    close,
    refresh,
    setGroups(next) {
      groups = next;
      updateTriggerVisibility();
      refresh();
    },
    destroy() {
      if (destroyed) return;
      close();
      destroyed = true;
      trigger.remove();
      dropdown.remove();
    },
  };
}
