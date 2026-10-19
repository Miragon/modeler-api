import type { ModuleDeclaration } from "didi";
import SelectionModule from "diagram-js/lib/features/selection";
import ZoomScrollModule from "diagram-js/lib/navigation/zoomscroll";
import MoveCanvasModule from "diagram-js/lib/navigation/movecanvas";
import { Viewer } from "./Viewer.js";
import { cmHoverTooltipModule } from "./hover-tooltip/index.js";

/** Read-only + navigation: zoom (scroll), pan (drag), selection, the elements' own data on hover. */
export class NavigatedViewer extends Viewer {
  protected override _getModules(): ModuleDeclaration[] {
    return [
      ...super._getModules(),
      SelectionModule,
      ZoomScrollModule,
      MoveCanvasModule,
      cmHoverTooltipModule,
    ];
  }
}
