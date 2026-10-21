import type EventBus from 'diagram-js/lib/core/EventBus';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type BaseEditorActions from 'diagram-js/lib/features/editor-actions/EditorActions';
import type Selection from 'diagram-js/lib/features/selection/Selection';
import type { Injector } from 'didi';
import { isNodeShape, type NodeShape } from '../model/di-types.js';
import type LabelEditing from '../label-editing/LabelEditing.js';

interface Toggle {
  toggle(): void;
}

/** Runs before the keyboard bindings (priority 500) look up the registered actions. */
const HIGH_PRIORITY = 1500;

/** The actions the keyboard bindings and hosts trigger, beyond diagram-js's own. */
export default class EditorActions {
  static $inject = ['eventBus', 'injector'];

  constructor(eventBus: EventBus, injector: Injector) {
    eventBus.on(
      'editorActions.init',
      HIGH_PRIORITY,
      (event: { editorActions: BaseEditorActions }) => {
        const { editorActions } = event;
        const service = <T>(name: string) => injector.get<T>(name, false);
        const handTool = service<Toggle>('handTool');
        const lassoTool = service<Toggle>('lassoTool');
        const selection = service<Selection>('selection');
        const registry = service<ElementRegistry>('elementRegistry');
        const labelEditing = service<LabelEditing>('labelEditing');
        if (handTool) editorActions.register({ handTool: () => handTool.toggle() });
        if (lassoTool) editorActions.register({ lassoTool: () => lassoTool.toggle() });
        if (selection && registry) {
          editorActions.register({
            selectAll: () => selection.select(registry.filter(isNodeShape)),
          });
        }
        if (selection && labelEditing) {
          editorActions.register({
            labelEditing: () => {
              const [selected, ...more] = selection.get();
              if (isNodeShape(selected) && more.length === 0)
                labelEditing.activate(selected as NodeShape);
            },
          });
        }
      },
    );
  }
}
