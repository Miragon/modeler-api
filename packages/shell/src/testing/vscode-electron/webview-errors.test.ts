import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  WEBVIEW_ERRORS_SHOWN,
  describeWebviewErrors,
  isOwnWebviewUrl,
  topStackUrl,
  watchWebviewErrors,
  type WebviewConsoleMessage,
  type WebviewErrorEvents,
  type WebviewOwner,
} from "./webview-errors.js";

// What VS Code 1.143.1 reported in Docker for a webview that throws on start (Event Storming),
// the extension folder renamed.
const EXTENSION_ID = "miragon-gmbh.event-storming-modeler";
const EXTENSION_FOLDER = "/work/smoke/event-storming-vsix-qtuoGE/extension";
const BUNDLE = `https://file+.vscode-resource.vscode-cdn.net${EXTENSION_FOLDER}/dist/webview.js`;
const FONT = `https://file+.vscode-resource.vscode-cdn.net${EXTENSION_FOLDER}/dist/fonts/geist.woff2`;
const HOST_PAGE =
  "vscode-webview://1p2hs8aci08es17b63clnougjluc8k25a0r05plii50nibij6iqp/index.html?id=9ea65fea-d862-4e73-b091-a3a393baad8d" +
  `&parentId=1&origin=a00d51cc-8fee-4b0e-90a6-5d68f3bdec52&swVersion=6&extensionId=${EXTENSION_ID}` +
  "&platform=electron&vscode-resource-base-authority=vscode-resource.vscode-cdn.net&parentOrigin=vscode-file%3A%2F%2Fvscode-app";
const WORKBENCH =
  "vscode-file://vscode-app/root/.cache/miragon-modeler-shell/vscode-test/vscode-linux-arm64-1.143.1/resources/app/out/vs/workbench/workbench.desktop.main.js";
const OTHER_BUNDLE =
  "https://file+.vscode-resource.vscode-cdn.net/root/.vscode/extensions/other/dist/preview.js";

const OWNER: WebviewOwner = { extensionId: EXTENSION_ID, extensionFolders: [EXTENSION_FOLDER] };

function thrown(message: string, url = BUNDLE): Error {
  const error = new Error(message);
  error.stack = `Error: ${message}\n    at ${url}:406:113630\n    at ${url}:408:2480`;
  return error;
}

function consoleMessage(
  type: string,
  text: string,
  url: string,
  lineNumber = 0,
  columnNumber = 0,
): WebviewConsoleMessage {
  return {
    type: () => type,
    text: () => text,
    location: () => ({ url, lineNumber, columnNumber }),
  };
}

/** Playwright's page as far as the watch goes: an emitter of `console` and `pageerror`. */
function fakePage() {
  return new EventEmitter() as EventEmitter & WebviewErrorEvents;
}

describe("isOwnWebviewUrl", () => {
  it("takes the files of the extension's folder that a webview loaded", () => {
    expect(isOwnWebviewUrl(BUNDLE, OWNER)).toBe(true);
    expect(
      isOwnWebviewUrl(`https://file+.vscode-resource.vscode-cdn.net${EXTENSION_FOLDER}`, OWNER),
    ).toBe(true);
  });

  it("takes the documents of the extension's webview, whatever the case of its id", () => {
    expect(isOwnWebviewUrl(HOST_PAGE, OWNER)).toBe(true);
    expect(
      isOwnWebviewUrl(HOST_PAGE.replace(EXTENSION_ID, EXTENSION_ID.toUpperCase()), OWNER),
    ).toBe(true);
  });

  it("leaves out the workbench, other extensions' webviews and other folders", () => {
    expect(isOwnWebviewUrl(WORKBENCH, OWNER)).toBe(false);
    expect(isOwnWebviewUrl(OTHER_BUNDLE, OWNER)).toBe(false);
    expect(
      isOwnWebviewUrl(HOST_PAGE.replace(EXTENSION_ID, "vscode.markdown-language-features"), OWNER),
    ).toBe(false);
    expect(isOwnWebviewUrl(BUNDLE.replace("/extension/", "/extension-old/"), OWNER)).toBe(false);
    expect(isOwnWebviewUrl(`https://example.com${EXTENSION_FOLDER}/dist/webview.js`, OWNER)).toBe(
      false,
    );
  });

  it("leaves out what is no URL, and a webview document when the extension has no id", () => {
    expect(isOwnWebviewUrl("", OWNER)).toBe(false);
    expect(isOwnWebviewUrl("<anonymous>", OWNER)).toBe(false);
    expect(isOwnWebviewUrl(HOST_PAGE, { ...OWNER, extensionId: undefined })).toBe(false);
  });

  it("decodes the URL's path and matches any of the extension's folders", () => {
    const owner: WebviewOwner = {
      extensionId: EXTENSION_ID,
      extensionFolders: ["/var/folders/x y/extension", "/private/var/folders/x y/extension"],
    };
    expect(
      isOwnWebviewUrl(
        "https://file+.vscode-resource.vscode-cdn.net/private/var/folders/x%20y/extension/dist/webview.js",
        owner,
      ),
    ).toBe(true);
    expect(
      isOwnWebviewUrl(
        "https://file+.vscode-resource.vscode-cdn.net/var/folders/x%20y/extension/dist/webview.js",
        owner,
      ),
    ).toBe(true);
  });

  it("matches a Windows folder in VS Code's form of the path", () => {
    const owner: WebviewOwner = {
      extensionId: EXTENSION_ID,
      extensionFolders: ["C:\\build\\smoke\\extension"],
    };
    expect(
      isOwnWebviewUrl(
        "https://file+.vscode-resource.vscode-cdn.net/c%3A/build/smoke/extension/dist/webview.js",
        owner,
      ),
    ).toBe(true);
  });
});

describe("topStackUrl", () => {
  it("is the URL of the topmost frame, without line and column", () => {
    expect(topStackUrl(thrown("boom").stack!)).toBe(BUNDLE);
    expect(topStackUrl(`Error: boom\n    at mount (${BUNDLE}:3:14)\n    at ${WORKBENCH}:1:1`)).toBe(
      BUNDLE,
    );
  });

  it("is undefined for a stack without a URL", () => {
    expect(topStackUrl("boom")).toBeUndefined();
    expect(topStackUrl("Error: https://example.com in the message only")).toBeUndefined();
    expect(topStackUrl("Error: boom\n    at <anonymous>")).toBeUndefined();
  });
});

describe("watchWebviewErrors", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["performance"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("collects the uncaught errors and console errors of the extension's webview, when they came", () => {
    const page = fakePage();
    const watch = watchWebviewErrors(page, OWNER);

    vi.advanceTimersByTime(1_000);
    page.emit("pageerror", thrown("thrown on start"));
    vi.advanceTimersByTime(500);
    page.emit(
      "console",
      consoleMessage("error", "Failed to load resource: net::ERR_FILE_NOT_FOUND", FONT),
    );

    expect(watch.uncaught.count).toBe(1);
    expect(watch.uncaught.first).toEqual([
      { text: thrown("thrown on start").stack, at: expect.any(Number) },
    ]);
    expect(watch.console.count).toBe(1);
    expect(watch.console.first[0]!.text).toBe(
      `Failed to load resource: net::ERR_FILE_NOT_FOUND\n    at ${FONT}:1:1`,
    );
    expect(watch.console.first[0]!.at - watch.uncaught.first[0]!.at).toBe(500);
  });

  it("keeps a console error's own stack, and names the place of one without, 1-based", () => {
    const page = fakePage();
    const watch = watchWebviewErrors(page, OWNER);
    const logged = `the board did not import Error: bad sticky\n    at ${BUNDLE}:406:113512`;

    page.emit("console", consoleMessage("error", logged, BUNDLE, 405, 113466));
    page.emit("console", consoleMessage("error", "the board did not import", BUNDLE, 405, 113466));

    expect(watch.console.first.map(({ text }) => text)).toEqual([
      logged,
      `the board did not import\n    at ${BUNDLE}:406:113467`,
    ]);
  });

  it("leaves out the workbench, other webviews, other message types and errors without a stack", () => {
    const page = fakePage();
    const watch = watchWebviewErrors(page, OWNER);

    page.emit(
      "console",
      consoleMessage(
        "error",
        "%c  ERR color: #f33 Extension 'github.copilot-chat' appears in product.json",
        WORKBENCH,
      ),
    );
    page.emit(
      "console",
      consoleMessage("warning", "Unrecognized feature: 'local-network-access'.", HOST_PAGE),
    );
    page.emit("console", consoleMessage("log", "started", BUNDLE));
    page.emit("console", consoleMessage("error", "preview failed", OTHER_BUNDLE));
    page.emit("pageerror", thrown("the workbench threw", WORKBENCH));
    page.emit("pageerror", thrown("another webview threw", OTHER_BUNDLE));
    page.emit("pageerror", Object.assign(new Error("thrown without a stack"), { stack: "" }));
    page.emit("pageerror", "a thrown string");

    expect(watch.uncaught).toEqual({ count: 0, first: [] });
    expect(watch.console).toEqual({ count: 0, first: [] });
  });

  it("takes an error of the webview's host page, whose URL names the extension", () => {
    const page = fakePage();
    const watch = watchWebviewErrors(page, OWNER);

    page.emit("console", consoleMessage("error", "Refused to load the script", HOST_PAGE));
    page.emit("pageerror", thrown("the host page threw", HOST_PAGE));

    expect(watch.console.count).toBe(1);
    expect(watch.uncaught.count).toBe(1);
  });

  it(`counts every error and keeps the first ${WEBVIEW_ERRORS_SHOWN} of each kind`, () => {
    const page = fakePage();
    const watch = watchWebviewErrors(page, OWNER);

    for (let index = 1; index <= 5; index++) page.emit("pageerror", thrown(`frame ${index}`));

    expect(watch.uncaught.count).toBe(5);
    expect(watch.uncaught.first.map(({ text }) => text.split("\n")[0])).toEqual([
      "Error: frame 1",
      "Error: frame 2",
      "Error: frame 3",
    ]);
  });

  it("stops listening on stop", () => {
    const page = fakePage();
    const watch = watchWebviewErrors(page, OWNER);
    expect(page.listenerCount("console")).toBe(1);
    expect(page.listenerCount("pageerror")).toBe(1);

    watch.stop();
    page.emit("pageerror", thrown("after the open step"));

    expect(page.listenerCount("console")).toBe(0);
    expect(page.listenerCount("pageerror")).toBe(0);
    expect(watch.uncaught.count).toBe(0);
  });
});

describe("describeWebviewErrors", () => {
  const at = 0;

  it("is empty without errors", () => {
    expect(
      describeWebviewErrors({
        uncaught: { count: 0, first: [] },
        console: { count: 0, first: [] },
      }),
    ).toBe("");
  });

  it("lists each error with its stack, indented, the uncaught ones first", () => {
    const uncaught = thrown("thrown on start").stack!;
    const logged = `the board did not import\n    at ${BUNDLE}:406:113467`;

    expect(
      describeWebviewErrors({
        uncaught: { count: 1, first: [{ text: uncaught, at }] },
        console: { count: 1, first: [{ text: logged, at }] },
      }),
    ).toBe(
      [
        "the webview reported 1 uncaught error and 1 console error:",
        "    uncaught Error: thrown on start",
        `        at ${BUNDLE}:406:113630`,
        `        at ${BUNDLE}:408:2480`,
        "    console.error: the board did not import",
        `        at ${BUNDLE}:406:113467`,
      ].join("\n"),
    );
  });

  it(`shows ${WEBVIEW_ERRORS_SHOWN} errors in all and counts the rest`, () => {
    const errors = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, index) => ({ text: `${prefix} ${index + 1}`, at }));

    expect(
      describeWebviewErrors({
        uncaught: { count: 2, first: errors("Error: thrown", 2) },
        console: { count: 7, first: errors("logged", 3) },
      }),
    ).toBe(
      [
        "the webview reported 2 uncaught errors and 7 console errors:",
        "    uncaught Error: thrown 1",
        "    uncaught Error: thrown 2",
        "    console.error: logged 1",
        "    and 6 more",
      ].join("\n"),
    );
  });

  it("names only the kinds that came", () => {
    expect(
      describeWebviewErrors({
        uncaught: { count: 0, first: [] },
        console: {
          count: 2,
          first: [
            { text: "a", at },
            { text: "b", at },
          ],
        },
      }).split("\n")[0],
    ).toBe("the webview reported 2 console errors:");
  });

  it("cuts a long error to twelve lines of at most 500 characters", () => {
    const text = [
      "Error: x".padEnd(600, "x"),
      ...Array.from({ length: 20 }, (_, index) => `    at f${index}`),
    ].join("\n");

    const lines = describeWebviewErrors({
      uncaught: { count: 1, first: [{ text, at }] },
      console: { count: 0, first: [] },
    }).split("\n");

    expect(lines).toHaveLength(1 + 12 + 1);
    expect(lines[1]).toBe(`    uncaught ${"Error: x".padEnd(500, "x")} …`);
    expect(lines.at(-2)).toBe("        at f10");
    expect(lines.at(-1)).toBe("    …");
  });
});
