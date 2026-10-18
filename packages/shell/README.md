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
  `@fontsource-variable/geist-mono` (no CDN).

Stylesheets, in this order:

```ts
import "./theme/cd-tokens.generated.css"; // vendored, unchanged, first
import "@fontsource-variable/geist/wght.css";
import "@fontsource-variable/geist-mono/wght.css";
import "diagram-js/assets/diagram-js.css"; // usually through the renderer's CSS
import "@miragon/<notation>-renderer/…css";
import "@miragon/modeler-shell/shell.css"; // last
```

| Entry                                     | For                                                         |
| ----------------------------------------- | ----------------------------------------------------------- |
| `@miragon/modeler-shell`                  | `mountShell`, icons, and everything of `./core`             |
| `@miragon/modeler-shell/core`             | DOM-free: fit math, keymap, zoom readout, appearance, sizes |
| `@miragon/modeler-shell/diagram-js`       | `shellModule`, the viewport, `connectDiagramJs`             |
| `@miragon/modeler-shell/vscode/extension` | webview HTML with CSP and nonce, theme bridge               |
| `@miragon/modeler-shell/vscode/webview`   | `mountVsCodeShell`, appearance handler, webview state       |
| `@miragon/modeler-shell/testing`          | the Playwright-driven shell conformance kit                 |
| `@miragon/modeler-shell/shell.css`        | every style of the shell                                    |

## Usage in a VS Code webview

Extension host, in `resolveCustomTextEditor`:

```ts
import * as vscode from "vscode";
import {
  connectThemeBridge,
  currentAppearance,
  renderWebviewHtml,
} from "@miragon/modeler-shell/vscode/extension";

const THEMES = ["light"] as const; // until the shared dark-mode release of the modelers

const asset = (file: string) =>
  webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", file)).toString();
webview.html = renderWebviewHtml({
  cspSource: webview.cspSource,
  scriptUri: asset("webview.js"),
  styleUris: [asset("webview.css")],
  title: "Event Storming Board",
  lang: "en",
  appearance: currentAppearance(vscode, { themes: THEMES }), // on <html> before the first paint
});
context.subscriptions.push(connectThemeBridge(vscode, webviewPanel, { themes: THEMES }));
```

Webview:

```ts
import { INVALID_STATUS_DELAY_MS } from "@miragon/modeler-shell";
import { connectDiagramJs, shellModule } from "@miragon/modeler-shell/diagram-js";
import { mountVsCodeShell, readShellState, writeShellState } from "@miragon/modeler-shell/vscode/webview";

const vscode = acquireVsCodeApi();
const stored = readShellState(vscode);

// The diagram first: a modeler keyboard on document must run before the shell's key listener.
const modeler = new Modeler({ additionalModules: [shellModule] });
const shell = mountVsCodeShell(document.getElementById("app")!, {
  themes: ["light"],
  canvas: modeler.container,
  menu: { model: [/* Level, Type captions … */], export: [/* Export as PNG, SVG */] },
  problems: { onActivate: () => vscode.postMessage({ type: "showProblems" }) },
  emptyHint: { onInsertExample: () => vscode.postMessage({ type: "insertExample" }) },
});
const { viewport } = connectDiagramJs(shell, modeler, { contentBounds: () => boardBounds() });
viewport.onChange(() => writeShellState(vscode, { view: viewport.getState() }));

async function importText(text: string, first: boolean): Promise<void> {
  const keep = first ? undefined : viewport.getViewbox();
  try {
    await modeler.importDSL(text);
    shell.setReadOnly(false);
    shell.setStatus(null);
    if (keep) viewport.restore(keep);
    else if (first && stored.view) viewport.setState(stored.view);
    viewport.afterImport(); // the first import with content fits
    shell.setEmptyHint(isEmpty());
  } catch {
    // locked at once, visible after 800ms without a valid import (no flicker while typing)
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
modeler declaring `["light"]` stays light under any VS Code theme, high contrast passes. The
complete Event Storming example, including the export notification, is in [API.md][api]. Document
sync, undo through the document and diagnostics stay in the modeler for 0.1.

## Usage in a web app

```ts
import { mountShell } from "@miragon/modeler-shell";
import { connectDiagramJs, shellModule } from "@miragon/modeler-shell/diagram-js";

// index.html carries <html lang="en" data-cd-theme="light"> statically while the modeler is light-only
const modeler = new Modeler({ additionalModules: [shellModule] });
const shell = mountShell(document.getElementById("app")!, {
  host: "web",
  canvas: modeler.container,
  menu: { export: [/* … */], help: [/* Keyboard shortcuts… */] },
  legend: { render: renderLegend, open: storedLegendOpen(), onToggle: storeLegendOpen },
});
const { viewport } = connectDiagramJs(shell, modeler, { contentBounds: () => contentBounds() });
await modeler.importXML(xml);
viewport.afterImport();
```

The `web` host prevents the browser's page zoom for the chrome keys (outside text fields and
dialogs), lifts pill and legend above the legal line and fits with the web insets. The rest of the
web-app chrome (primary action, legal line, File and Appearance groups, toasts, empty state) is not
part of 0.1.

## Usage in a foreign page

`mountShell(container, { host: "embedded", canvas })` on an explicitly sized container: the root
carries the tool's `lang` itself, keys act only while the focus is inside the modeler, and the page's
`<html>` stays untouched. Until contract 1.1 of `@miragon/modeler-api` an embedded modeler has no
appearance channel and stays light.

## The conformance kit

Every modeler runs the kit in its own Playwright suite against its real webview or page. It checks
the geometry of every island (±1px), ARIA and the keyboard models, that every chrome key acts exactly
once and never reaches VS Code, that nothing is ever half-dark, and that `destroy()` leaves nothing
behind:

```ts
import { test } from "@playwright/test";
import { registerShellConformance } from "@miragon/modeler-shell/testing";

test.describe("shell conformance", () => {
  test.describe.configure({ timeout: 60_000 }); // geometry measures three sizes
  registerShellConformance(
    {
      host: "ide",
      themes: ["light"],
      async open(page, { size, requested }) {
        await page.setViewportSize(size);
        await page.goto(`/webview.html?theme=${requested.theme}&kontrast=${requested.kontrast ?? ""}`);
        await page.waitForSelector(".cd-shell");
      },
      async destroy(page) {
        await page.evaluate(() => window.modeler.destroy());
      },
      show: {
        async problems(page) {
          await page.evaluate(() => window.shell.setProblems({ count: 2, errors: 1 }));
        },
      },
    },
    test,
  );
});
```

The harness opens the modeler with the appearance the kit requests, the way its host would. What
each case asserts, and what the kit installs in the page, is listed in [API.md][api].

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
host requests (`theme`, `kontrast=hoch`) and the state to start in (`legend=open`, `inspector`,
`problems=2:1`, `status=danger`, `invalid`, `empty`). In the `ide` host it stands in for VS Code: the
default webview stylesheet in `@layer vscode-default`, `<html>` from `renderWebviewHtml`, the host
page's theme classes and the real theme bridge.

The e2e suite runs the conformance kit for the `ide`, `web` and `embedded` hosts with a light-only
and a dark-capable modeler, switches VS Code themes at runtime, checks the chrome's typography
against VS Code's default styles, and proves with saboteurs that every case of the kit fails when
its rule is broken.

| Directory                   | Module                                                             |
| --------------------------- | ------------------------------------------------------------------ |
| `src/core`                  | DOM-free: fit math, keymap, zoom readout, appearance, sizes, texts |
| `src/dom`                   | `mountShell`: menu, zoom panel, tooltip, pill, status, slots, keys |
| `src/diagram-js`            | `shellModule`, viewport, `connectDiagramJs`, palette skin          |
| `src/vscode`                | extension side (HTML, theme bridge) and webview side               |
| `src/testing`               | the Playwright-driven conformance kit                              |
| `src/*.ts`, `src/shell.css` | the entry points                                                   |
| `demo/`, `e2e/`             | the demo modeler, its VS Code stub and the e2e suite               |
| `fixtures/tokens`           | the token files, vendored unchanged for the tests and the demo     |

A module imports another one only through its `index.ts`; `src/core` imports nothing outside
itself and compiles without the DOM library. `test/package-boundaries.test.ts` enforces this, the
zero runtime dependencies, the exact devDependency pins and the token-only stylesheets.

## License

MIT. The inlined Lucide icons are ISC, see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

[guide]: https://github.com/Miragon/corporate-identity/blob/main/plugins/miragon-brand/skills/modeler-tool-design/assets/modeler-design-system.md
[notes]: https://github.com/Miragon/modeler-api/blob/main/docs/shell/implementation-notes.md
[api]: https://github.com/Miragon/modeler-api/blob/main/packages/shell/API.md
