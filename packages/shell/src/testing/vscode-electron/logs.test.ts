import { describe, expect, it } from "vitest";

import { extensionActivationFailures } from "./logs.js";

// An excerpt of VS Code 1.143.0's exthost.log for an extension whose bundle requires a missing module.
const log = [
  "2026-10-21 19:33:09.166 [info] Extension host with pid 52034 started",
  "2026-10-21 19:33:09.216 [info] ExtensionService#_doActivateExtension miragon-gmbh.context-maps-modeler, startup: false, activationEvent: 'onCustomEditor:contextMaps.editor'",
  "2026-10-21 19:33:09.226 [error] Activating extension miragon-gmbh.context-maps-modeler failed due to an error:",
  "2026-10-21 19:33:09.226 [error] Error: Cannot find module './impl/format'",
  "Require stack:",
  "- /workspace/apps/vscode/dist/extension.cjs",
  "\tat node:internal/modules/cjs/loader:1571:15",
  "2026-10-21 19:33:09.226 [info] ExtensionService#_doActivateExtension vscode.json-language-features, startup: false, activationEvent: 'onLanguage:jsonc'",
  "2026-10-21 19:33:24.479 [info] Extension host terminating: received terminate message from renderer",
].join("\n");

describe("extensionActivationFailures", () => {
  it("joins VS Code's headline and the error's first line", () => {
    expect(extensionActivationFailures(log, "miragon-gmbh.context-maps-modeler")).toEqual([
      "Activating extension miragon-gmbh.context-maps-modeler failed due to an error: Error: Cannot find module './impl/format'",
    ]);
  });

  it("compares the extension id case-insensitively, as VS Code does", () => {
    expect(extensionActivationFailures(log, "Miragon-GmbH.Context-Maps-Modeler")).toHaveLength(1);
  });

  it("ignores other extensions and an extension that activated", () => {
    expect(extensionActivationFailures(log, "miragon-gmbh.value-chain-modeler")).toEqual([]);
    expect(extensionActivationFailures(log, "vscode.json-language-features")).toEqual([]);
    expect(extensionActivationFailures("", "miragon-gmbh.context-maps-modeler")).toEqual([]);
  });

  it("keeps the headline alone when the log ends after it, and reads Windows line ends", () => {
    const cut = "2026-10-21 19:33:09.226 [error] Activating extension a.b failed due to an error:";
    expect(extensionActivationFailures(cut, "a.b")).toEqual([
      "Activating extension a.b failed due to an error:",
    ]);
    expect(
      extensionActivationFailures(`${cut}\r\n2026-10-21 19:33:09.226 [error] TypeError: x\r\n`, "a.b"),
    ).toEqual(["Activating extension a.b failed due to an error: TypeError: x"]);
  });
});
