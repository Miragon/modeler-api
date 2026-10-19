# @miragon/modeler-shell

The shared, framework-free chrome around Miragon diagram-js modelers: the menu button with its
dropdown, the horizontal palette skin, the chrome tooltip, the zoom panel with its keys and fit, the
problems pill, the status box, the empty-file hint, legend and inspector slots, and the plumbing to
a VS Code webview. One implementation for every modeler and every host (VS Code webview, web app,
embedded in a foreign page), so the chrome looks and behaves the same everywhere.

- **Look and behaviour** follow the Miragon design system, guide
  [`modeler-design-system.md`][guide] §5, §6, §8, §9, §11, §12 and §13.3 to §13.5 (skill
  `miragon-brand:modeler-tool-design`; the repository is private, the link opens for Miragon staff).
- **Mechanics** (diagram-js services, VS Code quirks, why things are done the way they are) are in
  the [implementation notes][notes].
- **API**: every entry point, type and rule in [API.md][api].
- **Plan**: Phase 4 of [Miragon/modeler-api#4](https://github.com/Miragon/modeler-api/issues/4); the
  Event Storming modeler is the pilot.

Zero runtime dependencies: diagram-js services are typed structurally, the `vscode` namespace and
Playwright's `page` and `test` are passed in, nothing is imported at runtime. The stylesheet reads
only the design system's `--cd-ui-*` roles and `--cd-shell-*` sizes. All texts are English by default
and overridable through one messages table; numbers go through `Intl` in the UI language.

## Install

```sh
npm i --save-exact @miragon/modeler-shell
```

The modeler brings what the shell styles against and draws into:

- **diagram-js** 15.28 or later (directly or through its renderer);
- **the design tokens**: `cd-tokens.generated.css` (and `cd-tokens.generated.json` where scripts
  need values) of the design system, 1.12.0 or later (the release with the `shell` group). Copy
  both unchanged from the skill's `assets/` or from
  <https://corporate-identity.netlify.app/brand/cd-tokens.generated.css> and
  <https://corporate-identity.netlify.app/brand/cd-tokens.generated.json>, mark them as generated,
  and re-copy instead of editing. The shell ships no tokens and never forks a value;
- **the fonts** Geist and Geist Mono, bundled locally, for example `@fontsource-variable/geist` and
  `@fontsource-variable/geist-mono` (no CDN);
- for `./vscode/extension`: **VS Code 1.90 or later**, whose extension host runs Node 20 (the global
  `crypto` that `createNonce` uses; the types are tested against `@types/vscode` 1.96). Declare
  `engines.vscode` accordingly and target `node20` in the extension-host bundle.

Stylesheets, in this order. The tokens come first, unless the renderer's stylesheet already imports
them (Event Storming's does), and are never loaded twice:

```ts
import "./theme/cd-tokens.generated.css"; // vendored, unchanged, first; left out when the renderer CSS brings it
import "@fontsource-variable/geist/wght.css";
import "@fontsource-variable/geist-mono/wght.css";
import "diagram-js/assets/diagram-js.css"; // usually through the renderer's CSS
import "@miragon/<notation>-renderer/…css";
import "@miragon/modeler-shell/shell.css"; // last
```

The shell computes fit insets, breakpoints and layers from its own copy of the sizes (`SHELL`), while
its stylesheet reads the vendored `--cd-shell-*` tokens. Pin the two together in a unit test (Vitest
or `node:test`), not in the e2e suite, since the check is pure data:

```ts
// test/tokens.sync.test.ts
import { SHELL, SHELL_TOKENS, shellSizesFromTokens } from "@miragon/modeler-shell/core";

expect(SHELL).toEqual(shellSizesFromTokens(vendoredTokens.shell));
expect(Object.keys(vendoredTokens.shell)).toEqual(expect.arrayContaining(Object.values(SHELL_TOKENS)));
```

| Entry                                        | For                                                         |
| -------------------------------------------- | ----------------------------------------------------------- |
| `@miragon/modeler-shell`                     | `mountShell`, icons, and everything of `./core`             |
| `@miragon/modeler-shell/core`                | DOM-free: fit math, keymap, zoom readout, appearance, sizes |
| `@miragon/modeler-shell/diagram-js`          | `shellModule`, the viewport, `connectDiagramJs`             |
| `@miragon/modeler-shell/vscode/extension`    | webview HTML with CSP and nonce, theme bridge               |
| `@miragon/modeler-shell/vscode/webview`      | `mountVsCodeShell`, appearance handler, webview state       |
| `@miragon/modeler-shell/testing`             | the Playwright-driven shell conformance kit                 |
| `@miragon/modeler-shell/testing/vscode-stub` | a stand-in for VS Code around a webview test page           |
| `@miragon/modeler-shell/shell.css`           | every style of the shell                                    |

TypeScript: every entry resolves under `moduleResolution` `node16`, `bundler` and `node10`, and
every optional input field accepts `undefined`, so a modeler compiling with
`exactOptionalPropertyTypes` forwards optional values as they are.

## Usage in a VS Code webview

Extension host:

```ts
import * as vscode from "vscode";
import {
  connectThemeBridge,
  currentAppearance,
  renderWebviewHtml,
} from "@miragon/modeler-shell/vscode/extension";

const THEMES = ["light"] as const; // until the shared dark-mode release of the modelers

// activate(): a hidden tab keeps document, view and selection
vscode.window.registerCustomEditorProvider(viewType, provider, {
  webviewOptions: { retainContextWhenHidden: true },
});

// resolveCustomTextEditor():
const dist = vscode.Uri.joinPath(extensionUri, "dist");
webview.options = { enableScripts: true, localResourceRoots: [dist] }; // script, CSS and font files
const asset = (file: string) => webview.asWebviewUri(vscode.Uri.joinPath(dist, file)).toString();
webview.html = renderWebviewHtml({
  cspSource: webview.cspSource,
  scriptUri: asset("webview.js"),
  styleUris: [asset("webview.css")],
  title: "Event Storming Board",
  lang: "en",
  appearance: currentAppearance(vscode, { themes: THEMES }), // on <html> before the first paint
});
connectThemeBridge(vscode, webviewPanel, { themes: THEMES }); // disposes itself with the panel
```

The bridge's disposable is only for ending it before the panel closes; never push it into
`context.subscriptions`, which would keep one dead bridge per opened editor until the extension
deactivates.

Bundle the fonts as files next to the webview bundle, not as data URLs: with esbuild
`loader: { ".woff2": "file", ".woff": "file" }` and `assetNames: "fonts/[name]-[hash]"` the browser
fetches only the subsets a page's `unicode-range` needs (Geist Mono alone brings six; inlined they
roughly double the webview CSS). The CSP of `renderWebviewHtml` allows fonts from `cspSource`, and
`dist` is in `localResourceRoots`. A webview that bundles zod 4 runs `z.config({ jitless: true })` in
a module it imports before any schema module: the CSP forbids eval, and zod's eval probe would report
a violation on every schema even though zod catches the error.

Webview:

```ts
import { INVALID_STATUS_DELAY_MS } from "@miragon/modeler-shell";
import { connectDiagramJs, shellModule } from "@miragon/modeler-shell/diagram-js";
import {
  mountVsCodeShell,
  persistView,
  readShellState,
  writeShellState,
} from "@miragon/modeler-shell/vscode/webview";

const vscode = acquireVsCodeApi();
const stored = readShellState(vscode);

// The diagram first: a modeler keyboard on document must run before the shell's key listener.
// A renderer that builds its diagram lazily builds it now; width and height follow the shell's slot.
// The renderer's own Cmd/Ctrl+Z binding goes off in the IDE host, because VS Code's document history
// owns undo (Event Storming: undoRedoKeys: false).
const modeler = new Modeler({ width: "100%", height: "100%", additionalModules: [shellModule] });
modeler.get("canvas");
const shell = mountVsCodeShell(document.getElementById("app")!, {
  themes: ["light"],
  canvas: modeler.container,
  menu: {
    model: [/* Level; Type captions with keepEnabledWhenReadOnly, a view toggle */],
    export: [/* Export as PNG, SVG */],
    help: [/* Keyboard shortcuts… (the modeler's dialog in 0.1) */],
  },
  legend: {
    render: renderLegend,
    open: stored.legendOpen,
    onToggle: (open) => writeShellState(vscode, { legendOpen: open }),
  },
  problems: { onActivate: () => vscode.postMessage({ type: "showProblems" }) },
  emptyHint: { onInsertExample: () => vscode.postMessage({ type: "insertExample" }) },
});
const { viewport } = connectDiagramJs(shell, modeler, {
  // the tight bounds of the content, no padding: the shell's fit insets are the only margin
  contentBounds: () => elementBounds(), // undefined while there is nothing to fit
  isEmpty: () => elementCount() === 0, // cheap: no export, no validation
});
persistView(vscode, viewport); // writes the view once it rested, not on every frame

async function importText(text: string, first: boolean): Promise<void> {
  const keep = first ? undefined : viewport.getViewbox();
  try {
    await modeler.importDSL(text);
    lockCanvas(false);
    shell.setReadOnly(false);
    shell.setStatus(null);
    if (keep) viewport.restore(keep);
    else if (first && stored.view) viewport.setState(stored.view);
    viewport.afterImport(); // first content fits, an empty file shows 100 %, the hint follows by itself
  } catch {
    // locked at once, visible after 800ms without a valid import (no flicker while typing)
    lockCanvas(true); // the modeler's own lock: context pad, move, resize, delete, paste, label editor
    shell.setReadOnly(true, { delayMs: INVALID_STATUS_DELAY_MS });
    shell.setStatus(
      { severity: "danger", text: shell.messages.invalidFile("Event Storming board") },
      { delayMs: INVALID_STATUS_DELAY_MS },
    );
  }
}
```

`mountVsCodeShell` stops every key the webview handles on `document`, before VS Code's listener on
`window` forwards it to the workbench, and keeps the webview in the mode the extension resolved: a
modeler declaring `["light"]` stays light under any VS Code theme, high contrast passes, and VS
Code's `workbench.reduceMotion` stops the chrome's animations. Undo and redo on the canvas go to VS
Code (the shell keeps diagram-js's bindings off them), so a modeler's own keyboard binds no Cmd/Ctrl+Z
in the webview either. Keys the canvas uses act only there: Cmd/Ctrl+A on the canvas selects every
element (or is at least prevented), so VS Code's Select All never selects the chrome. The modeler's
keyboard also ignores keys with `defaultPrevented` and keys from outside the canvas container, and
puts no `tabindex` on it.

`shell.setReadOnly(true)` locks the palette (all but Lasso and Hand) and the Model entries of the
menu. View toggles stay usable: the shell's Legend checkbox and the legend's close button, and every
entry with `keepEnabledWhenReadOnly` (product decision, guide update pending in
Miragon/corporate-identity). The canvas itself is the modeler's to lock: no context pad, move,
resize, delete, paste or label editor. Content the modeler adds to `shell.root` (a "Keyboard
shortcuts…" dialog) is the modeler's too: it removes it in its own teardown, for example on
`diagram.destroy`, since `shell.destroy()` removes only what the shell added. The complete Event
Storming example, including the export notification, is in [API.md][api]. Document sync, undo through
the document and diagnostics stay in the modeler for 0.1.

## Usage in a web app

```ts
import { mountShell } from "@miragon/modeler-shell";
import { connectDiagramJs, shellModule } from "@miragon/modeler-shell/diagram-js";

// index.html carries <html lang="en" data-cd-theme="light"> statically while the modeler is light-only
const modeler = new Modeler({ width: "100%", height: "100%", additionalModules: [shellModule] });
const shell = mountShell(document.getElementById("app")!, {
  host: "web",
  canvas: modeler.container,
  menu: { export: [/* … */], help: [/* Keyboard shortcuts… */] },
  legend: { render: renderLegend, open: storedLegendOpen(), onToggle: storeLegendOpen },
});
const { viewport } = connectDiagramJs(shell, modeler, { contentBounds: () => elementBounds() });
await modeler.importXML(xml);
viewport.afterImport();
```

The `web` host prevents the browser's page zoom for the chrome keys (outside text fields and
dialogs), lifts pill and legend above the legal line and fits with the web insets. The rest of the
web-app chrome (primary action, legal line, File and Appearance groups, toasts, empty state) is not
part of 0.1.

## Usage in a foreign page

`mountShell(container, { host: "embedded", themes: ["light"], canvas })` on an explicitly sized
container: the root carries the tool's `lang` itself, keys act only while the focus is inside the
modeler, and the page's `<html>` stays untouched. Until contract 1.1 of `@miragon/modeler-api` an
embedded modeler has no appearance channel, so the root carries its own `data-cd-theme` (the first
of `themes`, light) and stays light inside a dark host page; it takes the page's
`data-cd-kontrast="hoch"` over from the nearest mode carrier above it. The page's element styles
(`button { text-transform: uppercase }`) do not reach the chrome.

## The conformance kit

Every modeler runs the kit in its own Playwright suite against its real webview or page. It checks
the geometry of every island (±1px), ARIA and the keyboard models, that every chrome key acts exactly
once and never reaches VS Code, that the canvas's own keys (Cmd/Ctrl+A) stay on the canvas, that
nothing is ever half-dark (the painted canvas surround and the palette's colours included), that
Enter on a creating palette entry adds one selected element, that an invalid file locks the canvas,
and that `destroy()` leaves nothing behind.

For the `ide` host the suite serves a test page that puts a stand-in for VS Code around the
modeler's webview code: VS Code's default webview styles, `<html>` as `renderWebviewHtml` writes it,
the host page's theme classes, `acquireVsCodeApi()` and the real theme bridge. Serve
`e2e/webview/` as the root of a Vite server, so the page is `/webview-test.html`:

```ts
// e2e/webview/webview-test.ts, the entry of e2e/webview/webview-test.html
import { installVsCodeWebviewStub, stubOptionsFromSearch } from "@miragon/modeler-shell/testing/vscode-stub";

// before the webview runs, which calls acquireVsCodeApi() and mounts the shell
installVsCodeWebviewStub({ ...stubOptionsFromSearch(location.search), themes: ["light"] });
const { webview } = await import("../../src/webview/main"); // exports { shell, modeler, connection, ready }

// for the harness only: the shipped bundle publishes nothing on window
window.shell = webview.shell;
window.modeler = webview.modeler;
window.connection = webview.connection;
void webview.ready.then(() => (window.webviewReady = true)); // the first import settled

// there is no extension host: post the document the way the extension would
window.postMessage({ type: "init", text: EXAMPLE_BOARD }, "*");
```

`ready`, `webviewReady` and the window globals belong to the modeler's test page (declared in a
`.d.ts` of the suite), not to the shell: the webview resolves `ready` once its first `init` import
settled.

```ts
// e2e/shell-conformance.spec.ts
import { test } from "@playwright/test";
import { registerShellConformance, vsCodeStubSearch } from "@miragon/modeler-shell/testing";

test.describe("shell conformance", () => {
  test.describe.configure({ timeout: 60_000 }); // geometry measures three sizes
  registerShellConformance(
    {
      host: "ide",
      themes: ["light"],
      absent: ["legend", "inspector"], // islands this modeler does not have: never visible, never skipped
      async open(page, { size, requested }) {
        await page.setViewportSize(size);
        await page.goto(`/webview-test.html?${vsCodeStubSearch(requested)}`);
        await page.waitForFunction(() => window.webviewReady === true); // set by the test page
      },
      async destroy(page) {
        // the webview's own teardown path: connection, diagram (with the modeler's dialogs), shell
        await page.evaluate(() => {
          window.connection.destroy();
          window.modeler.destroy();
          window.shell.destroy();
        });
      },
      show: {
        async problems(page) {
          await page.evaluate(() => window.postMessage({ type: "problems", count: 2, errors: 1 }, "*"));
        },
        async status(page) {
          await page.evaluate(() =>
            window.shell.setStatus({ severity: "danger", text: window.shell.messages.invalidFile("board") }),
          );
        },
        async invalid(page) {
          // the way the host makes the file invalid: a document update the parser rejects
          await page.evaluate((text) => window.postMessage({ type: "update", text }, "*"), INVALID_BOARD);
        },
      },
    },
    test,
    {
      onSkip(caseName, skips) {
        // with `absent` listing what the modeler lacks, every remaining skip is a gap of this suite
        throw new Error(`${caseName}: ${skips.map(({ hook, reason }) => `${hook}: ${reason}`).join("; ")}`);
      },
    },
  );
});
```

The harness opens the modeler with the appearance the kit requests, the way its host would; for
the `embedded` host the kit puts the foreign page itself in that mode. A skip names the harness
field it misses (`{ hook: "legend", reason }`; `hook: "destroy"` without a `destroy`; `hook: "open"`
when the opened document lacks what a case needs, such as a shape for `readOnly`); without `onSkip`
the kit warns on the console. What each case asserts, and what the kit installs in the page, is
listed in [API.md][api].

`registerShellConformance` declares every test inside the kit, so a runner reports them at the kit's
source (the package ships `src/` without its tests, so the location resolves). For test locations in
the suite's own spec file, register the cases there:

```ts
import { shellConformanceCases } from "@miragon/modeler-shell/testing";

for (const conformanceCase of shellConformanceCases()) {
  test(`shell conformance: ${conformanceCase.name}`, async ({ page }) => {
    const outcome = await conformanceCase.run(page, harness);
    if (outcome?.skipped) failOnSkips(conformanceCase.name, outcome.skipped);
  });
}
```

The test page runs the webview from source without a CSP. Add one smoke test of the production bundle
behind the HTML and CSP of `renderWebviewHtml` that fails on any `securitypolicyviolation` (the recipe
is in [API.md][api], `./vscode/extension`).

## Development

Run from the repository root (`-w packages/shell` for this package only):

```sh
npm run build -w packages/shell       # tsup: ESM + CJS + d.ts, dist/shell.css
npm run typecheck -w packages/shell   # src, core without the DOM library, demo
npm test -w packages/shell            # Vitest: node (core, boundaries) and happy-dom projects
npx playwright install chromium       # once
npm run test:e2e -w packages/shell    # Playwright against demo/
npm run demo -w packages/shell        # the demo page on http://localhost:5181
```

The demo page (`demo/`) is a small diagram-js modeler around the shell. Its query parameters choose
the host (`host=ide|web|embedded`), the modes the modeler declares (`themes=light,dark`), what the
host requests (`theme`, `kontrast=hoch`; embedded: the foreign page's own mode), the `ide` host's
`colorTheme` setting and `reduceMotion`, and the state to start in (`legend=open`, `inspector`,
`problems=2:1`, `status=danger`, `invalid`, `empty`, which opens at 100 %). In the `ide` host it runs
inside the stub of `./testing/vscode-stub`, and keeps view and legend state through
`acquireVsCodeApi()`.

The e2e suite runs the conformance kit for the `ide`, `web` and `embedded` hosts with a light-only
and a dark-capable modeler, switches VS Code themes and the `colorTheme` setting at runtime, checks
VS Code's reduce motion, the chrome's typography against VS Code's default styles and a hostile
foreign page, the canvas slot's paint and focus ring, and proves with saboteurs that every case of
the kit fails when its rule is broken.

| Directory                   | Module                                                             |
| --------------------------- | ------------------------------------------------------------------ |
| `src/core`                  | DOM-free: fit math, keymap, zoom readout, appearance, sizes, texts |
| `src/dom`                   | `mountShell`: menu, zoom panel, tooltip, pill, status, slots, keys |
| `src/diagram-js`            | `shellModule`, viewport, `connectDiagramJs`, palette skin          |
| `src/vscode`                | extension side (HTML, theme bridge) and webview side               |
| `src/testing`               | the Playwright-driven conformance kit and the VS Code stub         |
| `src/*.ts`, `src/shell.css` | the entry points                                                   |
| `test/`                     | package boundaries, token drift, the unit tests' helpers           |
| `demo/`, `e2e/`             | the demo modeler and the e2e suite                                 |
| `fixtures/tokens`           | the token files, vendored unchanged for the tests and the demo     |

A module imports another one only through its `index.ts`; `src/core` imports nothing outside
itself and compiles without the DOM library. `test/package-boundaries.test.ts` enforces this, the
zero runtime dependencies, the exact devDependency pins, the token-only stylesheets and the published
files (`dist`, `src` without its tests, `API.md` and the notices).

## License

MIT. The inlined Lucide icons are ISC (© Lucide Icons and Contributors), and `check`, `circle-x`,
`maximize`, `minus`, `plus`, `triangle-alert` and `x` derive from Feather, MIT (© Cole Bemis), as
Lucide's LICENSE lists them; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). `dist` keeps that
notice as a legal comment in the chunk with the icons, but a bundler's `legalComments` setting may
drop it: a VSIX or a web bundle that contains the shell carries the Lucide and Feather notices of
THIRD_PARTY_NOTICES.md itself.

[guide]: https://github.com/Miragon/corporate-identity/blob/main/plugins/miragon-brand/skills/modeler-tool-design/assets/modeler-design-system.md
[notes]: https://github.com/Miragon/modeler-api/blob/main/docs/shell/implementation-notes.md
[api]: https://github.com/Miragon/modeler-api/blob/main/packages/shell/API.md
