import BaseKeyboardBindings from 'diagram-js/lib/features/keyboard/KeyboardBindings';
import { hasModifier, isCmd, isKey } from 'diagram-js/lib/features/keyboard/KeyboardUtil';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type EditorActions from 'diagram-js/lib/features/editor-actions/EditorActions';
import type Keyboard from 'diagram-js/lib/features/keyboard/Keyboard';

interface KeyContext {
  keyEvent: KeyboardEvent;
}

export interface KeyboardConfig {
  /**
   * The contract's `undoRedoKeys` option: bind Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z and Ctrl+Y to the
   * canvas history (default true). A host that owns the history (VS Code) passes false, and the
   * keys reach it unprevented.
   */
  undoRedoKeys?: boolean | undefined;
}

const UNDO_REDO_ACTIONS = new Set(['undo', 'redo']);

/**
 * diagram-js's bindings (copy, paste, delete, zoom, …) on the focused canvas, plus the tool keys
 * L (lasso), H (hand), E (label) and Cmd/Ctrl+A: diagram-js binds no select all, and an
 * unprevented one reaches VS Code, whose Select All then selects the chrome's text.
 */
export default class KeyboardBindings extends BaseKeyboardBindings {
  static override $inject = ['eventBus', 'keyboard', 'config.diagramKeyboard'];

  private readonly undoRedoKeys: boolean;

  constructor(eventBus: EventBus, keyboard: Keyboard, config: KeyboardConfig | undefined) {
    super(eventBus, keyboard);
    this.undoRedoKeys = config?.undoRedoKeys ?? true;
  }

  override registerBindings(keyboard: Keyboard, editorActions: EditorActions): void {
    // Hiding undo and redo from the stock bindings leaves those keys unprevented.
    const bound = this.undoRedoKeys
      ? editorActions
      : (Object.create(editorActions, {
          isRegistered: {
            value: (action: string) =>
              !UNDO_REDO_ACTIONS.has(action) && editorActions.isRegistered(action),
          },
        }) as EditorActions);
    super.registerBindings(keyboard, bound);

    const addListener = (
      action: string,
      listener: (context: KeyContext) => boolean | undefined,
    ) => {
      if (editorActions.isRegistered(action)) keyboard.addListener(listener as never);
    };
    const bindKey = (action: string, keys: string[]) =>
      addListener(action, ({ keyEvent }) => {
        if (!isKey(keys, keyEvent) || hasModifier(keyEvent)) return undefined;
        editorActions.trigger(action, {});
        return true;
      });
    bindKey('lassoTool', ['l', 'L']);
    bindKey('handTool', ['h', 'H']);
    bindKey('labelEditing', ['e', 'E']);
    addListener('selectAll', ({ keyEvent }) => {
      if (!isCmd(keyEvent) || !isKey(['a', 'A'], keyEvent) || keyEvent.shiftKey) return undefined;
      editorActions.trigger('selectAll', {});
      return true;
    });
  }
}
