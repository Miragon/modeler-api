import type { ModuleDeclaration } from "didi";
import type CommandStack from "diagram-js/lib/command/CommandStack";

import ModelingModule from "diagram-js/lib/features/modeling";
import MoveModule from "diagram-js/lib/features/move";
import OutlineModule from "diagram-js/lib/features/outline";
import ResizeModule from "diagram-js/lib/features/resize";

import { NavigatedViewer } from "./NavigatedViewer.js";
import { cmModelingModule } from "./modeling/index.js";
import { cmRulesModule } from "./rules/index.js";
import { cmBehaviorsModule } from "./behaviors/index.js";
import { cmPaletteModule } from "./palette/index.js";
import { cmContextPadModule } from "./context-pad/index.js";
import { cmLabelEditingModule } from "./label-editing/index.js";
import { cmKeyboardModule } from "./keyboard/index.js";
import { cmZOrderModule } from "./zorder/index.js";

/**
 * Full Context Maps editor: palette/create, move, resize, connect with
 * rules, context pad, inline label editing, undo/redo.
 */
export class Modeler extends NavigatedViewer {
  protected override _getModules(): ModuleDeclaration[] {
    return [
      ...super._getModules(),
      // diagram-js stock
      ModelingModule,
      MoveModule,
      OutlineModule,
      ResizeModule,
      // Context Maps editor
      cmModelingModule,
      cmRulesModule,
      cmBehaviorsModule,
      cmPaletteModule,
      cmContextPadModule,
      cmLabelEditingModule,
      cmKeyboardModule,
      cmZOrderModule,
    ];
  }

  undo(): void {
    this.get<CommandStack>("commandStack").undo();
  }

  redo(): void {
    this.get<CommandStack>("commandStack").redo();
  }

  canUndo(): boolean {
    return this.get<CommandStack>("commandStack").canUndo();
  }

  canRedo(): boolean {
    return this.get<CommandStack>("commandStack").canRedo();
  }
}
