import { parseAppearanceChoice, type ShellMessages } from "../../core/index.js";
import type { ShellIconName } from "../icons.js";
import type { AppearanceHandle, FileMenuAction, FileMenuOptions, MenuEntry } from "../types.js";

interface FileEntrySpec {
  option: keyof FileMenuOptions;
  id: string;
  label: string;
  icon: ShellIconName | undefined;
}

function fileEntry(spec: FileEntrySpec, action: FileMenuAction): MenuEntry {
  const common = {
    id: spec.id,
    label: spec.label,
    ...(spec.icon ? { icon: spec.icon } : {}),
    ...(action.disabled ? { disabled: action.disabled } : {}),
    ...(action.shortcut ? { shortcut: action.shortcut } : {}),
    onSelect: () => action.onSelect(),
  };
  return action.dialog ? { kind: "dialog", ...common } : { kind: "action", ...common };
}

/**
 * The File group (guide §5.4, §2), first in the menu: "New diagram" (`file-plus`, id
 * `new-diagram`), "Open…" (`folder-open`, `open`), "Show example" (no icon, `show-example`),
 * "Import…" (`import`, `import`), in this order and only those `options` gives. `action` entries
 * (`dialog` with `FileMenuAction.dialog`) with the action's `shortcut` and `disabled`. Never
 * locked on a read-only canvas.
 */
export function fileMenuEntries(
  options: FileMenuOptions,
  messages: ShellMessages,
): readonly MenuEntry[] {
  const specs: readonly FileEntrySpec[] = [
    { option: "newDiagram", id: "new-diagram", label: messages.newDiagram, icon: "file-plus" },
    { option: "open", id: "open", label: messages.openFile, icon: "folder-open" },
    // §5.14 gives "Show example" no icon.
    { option: "showExample", id: "show-example", label: messages.showExample, icon: undefined },
    { option: "import", id: "import", label: messages.importFile, icon: "import" },
  ];
  return specs.flatMap((spec) => {
    const action = options[spec.option];
    return action ? [fileEntry(spec, action)] : [];
  });
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
  return [
    {
      kind: "radio",
      id: "appearance",
      label: messages.appearance,
      options: [
        { value: "system", label: messages.appearanceSystem },
        { value: "light", label: messages.appearanceLight },
        { value: "dark", label: messages.appearanceDark },
      ],
      value: () => appearance.choice(),
      onSelect: (value) => appearance.setChoice(parseAppearanceChoice(value)),
    },
  ];
}
