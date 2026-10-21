/*
 * The diagram's entries of the chrome menu (guide §5.4), the same in every host. The types mirror
 * the menu groups of `@miragon/modeler-shell` structurally, so an app hands the result to the
 * shell as it is while the renderer never imports the shell; apps/vscode/test/menu.sync.test.ts
 * pins the mirror. Add a `model` group for document settings the menu edits (an undoable command,
 * locked on a read-only canvas) and view toggles (`keepEnabledWhenReadOnly`).
 */

/** The icons the guide gives these entries (guide §5.14, the shell's common set). */
export type DiagramMenuIcon = 'file-image' | 'file-code-corner' | 'keyboard';

interface DiagramMenuItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: DiagramMenuIcon;
}

export interface DiagramMenuAction extends DiagramMenuItem {
  readonly kind: 'action';
  readonly shortcut?: string;
  onSelect(): void;
}

export interface DiagramMenuDialog extends DiagramMenuItem {
  readonly kind: 'dialog';
  onSelect(): void;
}

export interface DiagramMenu {
  readonly export: readonly DiagramMenuAction[];
  readonly help: readonly DiagramMenuDialog[];
}

export interface DiagramExport {
  onSelect(): void;
  /** The chip of an app key that runs the same export, e.g. "⌘S". */
  readonly shortcut?: string | undefined;
}

export interface DiagramMenuActions {
  /** PNG first (the more frequent target), then SVG, then the file itself where the host is not the file. */
  readonly exports: {
    readonly png: DiagramExport;
    readonly svg: DiagramExport;
    readonly text?: DiagramExport | undefined;
  };
  showKeyboardShortcuts(): void;
}

/** The label of the text export, also its row in the shortcuts dialog. */
export const TEXT_EXPORT_LABEL = 'Export as .__EXT__';

function exportEntry(id: string, label: string, action: DiagramExport, icon?: DiagramMenuIcon) {
  return {
    kind: 'action' as const,
    id,
    label,
    ...(icon ? { icon } : {}),
    ...(action.shortcut ? { shortcut: action.shortcut } : {}),
    onSelect: () => action.onSelect(),
  };
}

export function diagramMenu(actions: DiagramMenuActions): DiagramMenu {
  const { exports } = actions;
  return {
    export: [
      exportEntry('export-png', 'Export as PNG', exports.png, 'file-image'),
      exportEntry('export-svg', 'Export as SVG', exports.svg, 'file-code-corner'),
      ...(exports.text ? [exportEntry('export-text', TEXT_EXPORT_LABEL, exports.text)] : []),
    ],
    help: [
      {
        kind: 'dialog',
        id: 'keyboard-shortcuts',
        label: 'Keyboard shortcuts…',
        icon: 'keyboard',
        onSelect: () => actions.showKeyboardShortcuts(),
      },
    ],
  };
}
