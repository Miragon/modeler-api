import { describe, expect, it } from "vitest";

import { revealFileLabel } from "./index.js";

describe("revealFileLabel", () => {
  it.each([
    ["darwin", "Reveal in Finder"],
    ["win32", "Reveal in File Explorer"],
    ["linux", "Open Containing Folder"],
    ["freebsd", "Open Containing Folder"],
  ])("labels %s like VS Code: %s", (platform, label) => {
    expect(revealFileLabel(platform)).toBe(label);
  });
});
