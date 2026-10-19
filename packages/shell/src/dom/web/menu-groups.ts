import type { ShellMessages } from "../../core/index.js";
import type { AppearanceHandle, FileMenuOptions, MenuEntry } from "../types.js";

/**
 * The File group (guide §5.4, §2), first in the menu: "New diagram" (`file-plus`, id
 * `new-diagram`), "Open…" (`folder-open`, `open`), "Show example" (no icon, `show-example`),
 * "Import…" (`import`, `import`), in this order and only those `options` gives. `action` entries
 * (`dialog` with `FileMenuAction.dialog`) with the action's `shortcut` and `disabled`. Never
 * locked on a read-only canvas.
 */
export function fileMenuEntries(options: FileMenuOptions, messages: ShellMessages): readonly MenuEntry[] {
  // TODO(web-chrome): the four entries above.
  void options;
  void messages;
  return [];
}

/**
 * The Appearance group (guide §5.4, §13.3) between Export and Help: one radio group, id
 * `appearance`, label `messages.appearance`, options `system`, `light`, `dark` labelled
 * `messages.appearanceSystem` / `Light` / `Dark`, value `appearance.choice()`, selecting calls
 * `appearance.setChoice`. Never locked. The shell asks for it only when `themes` includes `"dark"`.
 */
export function appearanceMenuEntries(
  appearance: AppearanceHandle,
  messages: ShellMessages,
): readonly MenuEntry[] {
  // TODO(web-chrome): the radio group above.
  void appearance;
  void messages;
  return [];
}
