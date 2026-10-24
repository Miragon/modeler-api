import type { ModuleDeclaration } from "didi";
import { CmBaseViewer } from "./CmBaseViewer.js";
import { cmModelModule } from "./model/index.js";
import { cmDrawModule } from "./draw/index.js";
import { ioModule } from "./io/index.js";

/** Read-only renderer: draws a Context Maps diagram with no interaction. */
export class Viewer extends CmBaseViewer {
  protected _getModules(): ModuleDeclaration[] {
    return [cmModelModule, cmDrawModule, ioModule];
  }
}
