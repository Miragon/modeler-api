import type { ModuleDeclaration } from 'didi';
import EditorActionsModule from 'diagram-js/lib/features/editor-actions';
import KeyboardModule from 'diagram-js/lib/features/keyboard';
import EditorActions from './EditorActions.js';
import KeyboardBindings from './KeyboardBindings.js';

export const keyboardModule: ModuleDeclaration = {
  __depends__: [KeyboardModule, EditorActionsModule],
  __init__: ['diagramEditorActions'],
  keyboardBindings: ['type', KeyboardBindings],
  diagramEditorActions: ['type', EditorActions],
};

export type { KeyboardConfig } from './KeyboardBindings.js';
