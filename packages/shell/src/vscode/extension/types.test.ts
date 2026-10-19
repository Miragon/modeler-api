import type * as vscode from "vscode";
import { describe, expectTypeOf, it } from "vitest";

import type { DisposableLike, VsCodeLike, WebviewPanelLike } from "./index.js";

describe("structural vscode types", () => {
  it("accept the real vscode namespace", () => {
    expectTypeOf<typeof vscode>().toExtend<VsCodeLike>();
  });

  it("accept a real WebviewPanel", () => {
    expectTypeOf<vscode.WebviewPanel>().toExtend<WebviewPanelLike>();
  });

  it("accept a real Disposable", () => {
    expectTypeOf<vscode.Disposable>().toExtend<DisposableLike>();
  });
});
