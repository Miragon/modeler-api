import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { ProgressReport, ProgressReporter } from "@vscode/test-electron";
import type { ElectronApplication, FrameLocator, Page } from "playwright-core";
import type { Appearance, ChromeIsland, Size, Theme } from "../../core/index.js";
import {
  DEFAULT_WINDOW_SIZE,
  customEditorViewType,
  extensionIdOf,
  isPlainFileName,
  platformKeys,
  vsCodeEnvironment,
  vsCodeLaunchArgs,
  vsCodeUserSettings,
  type ExtensionManifest,
  type PlatformKeys,
  type VsCodeSmokePaths,
} from "./launch.js";
import {
  SmokeFailures,
  missingChrome,
  sameAppearance,
  screenshotFileName,
  type ChromePresence,
  type VsCodeSmokeResult,
  type VsCodeSmokeStep,
  type VsCodeSmokeThemeResult,
} from "./result.js";
import {
  VSCODE_COLOR_THEMES,
  WEBVIEW_THEME_BODY_CLASSES,
  describeAppearance,
  expectedWebviewAppearance,
  webviewBodyClasses,
  workbenchThemeClass,
  type VsCodeColorTheme,
} from "./themes.js";
import {
  activeEditorDirtyProbe,
  activeTextEditorProbe,
  blurProbe,
  canvasFactsProbe,
  chromeProbe,
  focusCreatingEntryProbe,
  settleProbe,
  webviewThemeProbe,
  workbenchThemeProbe,
  workbenchWebviewsProbe,
  type CanvasFacts,
  type WebviewThemeFacts,
} from "./webview.js";

/** The file the smoke test opens, written into a fresh workspace. */
export interface VsCodeSmokeFixture {
  /** A plain file name (`board.storm`); it also keys `workbench.editorAssociations`. */
  fileName: string;
  /** The document; it shows at least one element. */
  text: string;
}

/** What `edit` and `ready` get to drive VS Code. */
export interface VsCodeSmokeContext {
  /** The VS Code window. */
  page: Page;
  /** The modeler's webview document, inside VS Code's two webview frames. */
  webview: FrameLocator;
  /** The platform's save, undo and redo chords. */
  keys: PlatformKeys;
  /** The timeout of every wait. */
  timeoutMs: number;
}

export interface VsCodeSmokeOptions {
  /** The modeler's built extension folder (with its `package.json`), passed as `--extensionDevelopmentPath`. */
  extensionPath: string;
  fixture: VsCodeSmokeFixture;
  /** The modeler's parser: throws (or rejects) when the saved text is not a valid document. */
  parse: (text: string) => unknown;
  /**
   * Changes the document through the canvas, the way a user does, and leaves no label editor
   * open. Default `createFromPalette`: Enter on the first creating palette entry, then Escape.
   */
  edit?: ((context: VsCodeSmokeContext) => Promise<void>) | undefined;
  /** Resolves once the opened fixture is ready for the edit; default: the canvas shows a shape. */
  ready?: ((context: VsCodeSmokeContext) => Promise<void>) | undefined;
  /** How many undo steps take the edit back; default 1 (one canvas change is one document edit). */
  undoSteps?: number | undefined;
  /** The modes the modeler declares, as its extension passes them to the theme bridge; default `["light"]`. */
  themes?: readonly Theme[] | undefined;
  /** The VS Code themes to switch through, the first one also at start; default `VSCODE_COLOR_THEMES`. */
  colorThemes?: readonly VsCodeColorTheme[] | undefined;
  /** Islands that must be visible after opening and under every theme; default menu, palette and zoom. */
  chrome?: readonly ChromeIsland[] | undefined;
  /** Where to write `<name>-<theme id>.png`; no screenshots without it. */
  screenshotDir?: string | undefined;
  /** The screenshots' prefix; default the extension's `name`. */
  name?: string | undefined;
  /** The custom editor; default the first one whose selector matches the fixture's file name. */
  viewType?: string | undefined;
  /** `stable`, `insiders` or `1.96.0`; default the newest stable release that satisfies `engines.vscode`. */
  vscodeVersion?: string | undefined;
  /** Where `@vscode/test-electron` keeps its downloads; default `.vscode-test` in the working directory. */
  cachePath?: string | undefined;
  /** The window's content size; default 1280 × 800. */
  windowSize?: Size | undefined;
  /** The timeout of every single wait; default 30 s. */
  timeoutMs?: number | undefined;
  /** More user settings, merged over the driver's. */
  settings?: Readonly<Record<string, unknown>> | undefined;
  /** Progress lines (download, steps); default silent. */
  log?: ((line: string) => void) | undefined;
  /** Keeps the throwaway profile, workspace and VS Code logs, and logs where they are. */
  keepTemporaryFiles?: boolean | undefined;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const CLOSE_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 100;
const REOPEN_INTERVAL_MS = 2_000;
const DEFAULT_CHROME: readonly ChromeIsland[] = ["menu", "palette", "zoom"];
/** Names the screenshot of a webview that never showed, next to the theme screenshots. */
const OPEN_FAILURE: VsCodeColorTheme = { id: "open-failure", name: "", kind: 1 };

interface Peers {
  launch(options: {
    executablePath: string;
    args: string[];
    env: Record<string, string>;
    timeout: number;
  }): Promise<ElectronApplication>;
  download(options: {
    version?: string;
    cachePath?: string;
    extensionDevelopmentPath: string;
    reporter: ProgressReporter;
  }): Promise<string>;
}

// Lazy, so loading the entry needs no peer yet and a missing one gets an actionable message.
async function loadPeers(): Promise<Peers> {
  try {
    const [playwright, testElectron] = await Promise.all([
      import("playwright-core"),
      import("@vscode/test-electron"),
    ]);
    return {
      launch: (options) => playwright._electron.launch(options),
      download: (options) => testElectron.downloadAndUnzipVSCode(options),
    };
  } catch (error) {
    throw new Error(
      "@miragon/modeler-shell/testing/vscode-electron needs its optional peer dependencies: " +
        "npm i -D --save-exact playwright-core @vscode/test-electron",
      { cause: error },
    );
  }
}

function messageOf(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).split("\n")[0] ?? "";
}

function elapsed(since: number): number {
  return Math.round(performance.now() - since);
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

const delay = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

/** Reads until `done` holds or `timeoutMs` passed, and returns the last value either way. */
async function pollUntil<T>(
  read: () => Promise<T>,
  done: (value: T) => boolean,
  timeoutMs: number,
): Promise<{ value: T; met: boolean }> {
  const deadline = performance.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (done(value)) return { value, met: true };
    if (performance.now() >= deadline) return { value, met: false };
    await delay(POLL_INTERVAL_MS);
  }
}

function sameCanvas(a: CanvasFacts, b: CanvasFacts): boolean {
  return (
    a.shapes === b.shapes &&
    a.connections === b.connections &&
    a.positions.join(";") === b.positions.join(";")
  );
}

function describeCanvas(facts: CanvasFacts): string {
  return `${facts.shapes} shapes and ${facts.connections} connections`;
}

function appearanceOf(facts: WebviewThemeFacts): Appearance | undefined {
  if (facts.theme !== "light" && facts.theme !== "dark") return undefined;
  return facts.kontrast === "hoch" ? { theme: facts.theme, kontrast: "hoch" } : { theme: facts.theme };
}

async function readManifest(extensionPath: string): Promise<ExtensionManifest> {
  const file = join(extensionPath, "package.json");
  try {
    return JSON.parse(await readFile(file, "utf8")) as ExtensionManifest;
  } catch (error) {
    throw new Error(`runVsCodeSmoke: cannot read the extension manifest ${file}`, { cause: error });
  }
}

/**
 * The default `edit`: Enter on the first creating palette entry (the shell places the element in
 * the free area and selects it), then Escape for a label editor the creation opened.
 */
export async function createFromPalette(context: VsCodeSmokeContext): Promise<void> {
  const html = context.webview.locator("html");
  const before = await html.evaluate(canvasFactsProbe);
  const action = await html.evaluate(focusCreatingEntryProbe);
  if (!action) throw new Error("the palette has no enabled entry that creates an element");
  await context.page.keyboard.press("Enter");
  const created = await pollUntil(
    () => html.evaluate(canvasFactsProbe),
    (facts) => facts.shapes > before.shapes,
    context.timeoutMs,
  );
  if (!created.met) throw new Error(`Enter on the palette entry "${action}" added no element`);
  await context.page.keyboard.press("Escape");
}

async function defaultReady(context: VsCodeSmokeContext): Promise<void> {
  const shown = await pollUntil(
    () => context.webview.locator("html").evaluate(canvasFactsProbe),
    (facts) => facts.shapes > 0,
    context.timeoutMs,
  );
  if (!shown.met) throw new Error("the canvas shows no element of the fixture");
}

async function settle(context: VsCodeSmokeContext): Promise<void> {
  await context.webview.locator("html").evaluate(settleProbe);
  await context.page.evaluate(settleProbe);
}

async function closeApplication(app: ElectronApplication): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const closed = await Promise.race([
    app.close().then(
      () => true,
      () => true,
    ),
    new Promise<false>((done) => (timer = setTimeout(() => done(false), CLOSE_TIMEOUT_MS))),
  ]);
  clearTimeout(timer);
  // A modal dialog left by a failed step blocks a graceful quit.
  if (!closed) app.process().kill("SIGKILL");
}

/**
 * Starts a real VS Code with the modeler's built extension, opens `fixture` in its custom editor,
 * and checks the shell's chrome, an edit through the canvas, save, undo, and the theme bridge under
 * every color theme, with a screenshot per theme. A failed check never throws: it is in `failures`.
 * Throws for unusable options (no manifest, no matching custom editor, an unbuilt extension, a file
 * name with a path) and when the optional peers are missing.
 */
export async function runVsCodeSmoke(options: VsCodeSmokeOptions): Promise<VsCodeSmokeResult> {
  const started = performance.now();
  const log = options.log ?? (() => undefined);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const islands = options.chrome ?? DEFAULT_CHROME;
  const themes = options.themes ?? ["light"];
  const colorThemes = options.colorThemes ?? VSCODE_COLOR_THEMES;
  const { fileName } = options.fixture;
  if (!isPlainFileName(fileName)) {
    throw new Error(`runVsCodeSmoke: the fixture needs a plain file name, not "${fileName}"`);
  }

  const extensionPath = resolve(options.extensionPath);
  const manifest = await readManifest(extensionPath);
  const viewType = options.viewType ?? customEditorViewType(manifest, fileName);
  if (!viewType) throw new Error(`runVsCodeSmoke: no custom editor of ${extensionPath} opens ${fileName}`);
  if (manifest.main && !(await exists(join(extensionPath, manifest.main)))) {
    throw new Error(
      `runVsCodeSmoke: the extension is not built, ${join(extensionPath, manifest.main)} is missing`,
    );
  }
  const extensionId = extensionIdOf(manifest);
  const peers = await loadPeers();

  const failures = new SmokeFailures();
  const result: VsCodeSmokeResult = {
    ok: false,
    failures: failures.list,
    extensionId,
    viewType,
    chrome: {},
    undone: false,
    themes: [],
    timings: {},
  };
  /** Runs and times one step; a throw becomes the step's failure and the result `undefined`. */
  const step = async <T>(name: VsCodeSmokeStep, run: () => Promise<T>): Promise<T | undefined> => {
    const since = performance.now();
    log(`${name} …`);
    try {
      return await run();
    } catch (error) {
      failures.add(name, messageOf(error));
      return undefined;
    } finally {
      result.timings[name] = elapsed(since);
    }
  };

  const executablePath = await step("resolve", async () => {
    let lastTenth = -1;
    const reporter: ProgressReporter = {
      report(report: ProgressReport) {
        const stage = String(report.stage);
        if (stage === "resolvedVersion" && "version" in report) result.vscodeVersion = report.version;
        if (stage === "downloading" && "bytesSoFar" in report && report.totalBytes > 0) {
          const tenth = Math.floor((report.bytesSoFar / report.totalBytes) * 10);
          if (tenth !== lastTenth) log(`resolve: downloading VS Code, ${(lastTenth = tenth) * 10} %`);
        }
      },
      error(error: unknown) {
        log(`resolve: ${messageOf(error)}`);
      },
    };
    const path = await peers.download({
      ...(options.vscodeVersion ? { version: options.vscodeVersion } : {}),
      ...(options.cachePath ? { cachePath: resolve(options.cachePath) } : {}),
      extensionDevelopmentPath: extensionPath,
      reporter,
    });
    log(`resolve: VS Code ${result.vscodeVersion ?? "?"} at ${path}`);
    return path;
  });
  result.executablePath = executablePath;

  if (executablePath) {
    const root = await mkdtemp(join(tmpdir(), "modeler-shell-vscode-"));
    const launched: { app?: ElectronApplication } = {};
    try {
      await runSession({
        options,
        peers,
        step,
        failures,
        result,
        log,
        launched,
        executablePath,
        extensionPath,
        extensionId,
        viewType,
        islands,
        themes,
        colorThemes,
        timeoutMs,
        name: options.name ?? manifest.name ?? "modeler",
        paths: {
          userDataDir: join(root, "user-data"),
          extensionsDir: join(root, "extensions"),
          workspaceDir: join(root, "workspace"),
          file: join(root, "workspace", fileName),
        },
      });
    } finally {
      const app = launched.app;
      if (app) await step("close", () => closeApplication(app));
      if (options.keepTemporaryFiles) log(`kept ${root}`);
      else await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  }

  result.timings.total = elapsed(started);
  result.ok = failures.list.length === 0;
  return result;
}

/** One run's settled inputs, and where the launch step leaves the application for the cleanup. */
interface SessionRun {
  options: VsCodeSmokeOptions;
  peers: Peers;
  step: <T>(name: VsCodeSmokeStep, run: () => Promise<T>) => Promise<T | undefined>;
  failures: SmokeFailures;
  result: VsCodeSmokeResult;
  log: (line: string) => void;
  launched: { app?: ElectronApplication };
  executablePath: string;
  extensionPath: string;
  extensionId: string | undefined;
  viewType: string;
  islands: readonly ChromeIsland[];
  themes: readonly Theme[];
  colorThemes: readonly VsCodeColorTheme[];
  timeoutMs: number;
  name: string;
  paths: VsCodeSmokePaths;
}

async function runSession(run: SessionRun): Promise<void> {
  const { options, step, failures, result, log, paths, timeoutMs, islands } = run;
  const original = options.fixture.text;
  const settingsFile = join(paths.userDataDir, "User", "settings.json");
  const writeSettings = (colorTheme: string) =>
    writeFile(
      settingsFile,
      JSON.stringify(
        vsCodeUserSettings({
          colorTheme,
          fileName: options.fixture.fileName,
          viewType: run.viewType,
          extra: options.settings,
        }),
        null,
        2,
      ),
    );
  const readDisk = () => readFile(paths.file, "utf8");

  await mkdir(join(paths.userDataDir, "User"), { recursive: true });
  await mkdir(paths.extensionsDir, { recursive: true });
  await mkdir(paths.workspaceDir, { recursive: true });
  await writeFile(paths.file, original);
  await writeSettings((run.colorThemes[0] ?? VSCODE_COLOR_THEMES[0]!).name);

  const context = await step("launch", async (): Promise<VsCodeSmokeContext> => {
    const app = await run.peers.launch({
      executablePath: run.executablePath,
      args: vsCodeLaunchArgs(run.extensionPath, paths),
      env: vsCodeEnvironment(process.env),
      timeout: timeoutMs,
    });
    run.launched.app = app;
    const page = await app.firstWindow({ timeout: timeoutMs });
    // an `edit` of the modeler's own waits as long as the driver does
    page.setDefaultTimeout(timeoutMs);
    await page.waitForSelector(".monaco-workbench", { timeout: timeoutMs });
    const size = options.windowSize ?? DEFAULT_WINDOW_SIZE;
    await app.evaluate(({ BrowserWindow }, { width, height }) => {
      BrowserWindow.getAllWindows()[0]?.setContentSize(width, height);
    }, size);
    // The workbench may show other webviews; the outer frame's URL names the owning extension.
    const id = run.extensionId;
    const frame = id
      ? page.locator(
          `iframe.webview[src*="extensionId=${id}&" i], iframe.webview[src$="extensionId=${id}" i]`,
        )
      : page.locator("iframe.webview");
    const webview = frame.first().contentFrame().locator("iframe#active-frame").contentFrame();
    return { page, webview, keys: platformKeys(process.platform), timeoutMs };
  });
  if (!context) return;

  const html = context.webview.locator("html");
  const canvasFacts = () => html.evaluate(canvasFactsProbe);
  const dirty = () => context.page.evaluate(activeEditorDirtyProbe);

  const before = await step("open", async () => {
    if (!(await showCustomEditor(context, run))) {
      throw new Error(
        `the custom editor never showed the shell's menu ${await describeWebviews(context, run)}`,
      );
    }
    await (options.ready ?? defaultReady)(context);
    await settle(context);
    result.chrome = await html.evaluate(chromeProbe, islands);
    const missing = missingChrome(islands, result.chrome);
    if (missing) failures.add("open", missing);
    const facts = await canvasFacts();
    log(`open: ${run.viewType} shows ${describeCanvas(facts)}`);
    return facts;
  });
  if (!before) return;

  const edited = await step("edit", async () => {
    await (options.edit ?? createFromPalette)(context);
    const changed = await pollUntil(dirty, (value) => value, timeoutMs);
    if (!changed.met) throw new Error("the document did not change (its editor never turned dirty)");
    return true;
  });

  const saved =
    edited &&
    (await step("save", async () => {
      await context.page.keyboard.press(context.keys.save);
      const written = await pollUntil(readDisk, (text) => text !== original, timeoutMs);
      if (!written.met) throw new Error(`${context.keys.save} wrote nothing to disk`);
      const clean = await pollUntil(dirty, (value) => !value, timeoutMs);
      if (!clean.met) failures.add("save", "the editor is still dirty after the save");
      let parsed: unknown;
      try {
        parsed = await options.parse(written.value);
      } catch (error) {
        throw new Error(`the saved text does not parse: ${messageOf(error)}`);
      }
      result.saved = { text: written.value, parsed };
      return true;
    }));

  if (saved) {
    await step("undo", async () => {
      for (let index = 0; index < (options.undoSteps ?? 1); index++) {
        await context.page.keyboard.press(context.keys.undo);
      }
      const restored = await pollUntil(canvasFacts, (facts) => sameCanvas(facts, before), timeoutMs);
      if (!restored.met) {
        failures.add(
          "undo",
          `${context.keys.undo} did not bring the canvas back: it shows ${describeCanvas(restored.value)}, ` +
            `before the edit ${describeCanvas(before)}`,
        );
      }
      await pollUntil(dirty, (value) => value, timeoutMs);
      await context.page.keyboard.press(context.keys.save);
      const reverted = await pollUntil(readDisk, (text) => text === original, timeoutMs);
      if (!reverted.met) {
        throw new Error(`${context.keys.undo} and ${context.keys.save} did not restore the fixture's text`);
      }
      result.undone = restored.met;
    });
  }

  await step("themes", async () => {
    // The keyboard edit leaves the canvas focused; its focus ring would show in every screenshot.
    await html.evaluate(blurProbe);
    for (const theme of run.colorThemes) {
      const checked = await checkTheme(context, theme, {
        themes: run.themes,
        islands,
        timeoutMs,
        writeSettings,
        screenshotDir: options.screenshotDir,
        name: run.name,
      });
      result.themes.push(checked.result);
      for (const failure of checked.failures) failures.add("themes", failure);
      log(`themes: ${theme.name}, the webview shows ${describeAppearance(checked.result.observed)}`);
    }
  });
}

/**
 * Waits for the shell's menu in the webview. A file VS Code opens at start can resolve before the
 * development extension's custom editor is registered (seen on the first start of a fresh
 * download): it then shows as text. The driver closes it and opens it again from the Explorer,
 * where `workbench.editorAssociations` picks the custom editor once it is registered, and retries
 * until it is. False when the menu never showed.
 */
async function showCustomEditor(context: VsCodeSmokeContext, run: SessionRun): Promise<boolean> {
  const menu = context.webview.locator('[data-chrome="menu"]');
  const deadline = performance.now() + run.timeoutMs;
  let reopenedAt = Number.NEGATIVE_INFINITY;
  while (performance.now() < deadline) {
    if (await menu.isVisible()) return true;
    const retry = performance.now() - reopenedAt > REOPEN_INTERVAL_MS;
    if (retry && (await context.page.evaluate(activeTextEditorProbe))) {
      reopenedAt = performance.now();
      run.log(`open: VS Code shows ${run.options.fixture.fileName} as text, reopening it from the Explorer`);
      await context.page.keyboard.press(context.keys.close);
      await context.page
        .locator(".explorer-folders-view")
        .getByText(run.options.fixture.fileName, { exact: true })
        .first()
        .click();
    }
    await delay(POLL_INTERVAL_MS);
  }
  return menu.isVisible();
}

/**
 * Why the webview did not show: which webview frames the workbench has (a run that never opened
 * leaves no other trace), and a screenshot of the window when there is a `screenshotDir`.
 */
async function describeWebviews(context: VsCodeSmokeContext, run: SessionRun): Promise<string> {
  const sources = await context.page.evaluate(workbenchWebviewsProbe).catch((): string[] => []);
  const id = run.extensionId?.toLowerCase();
  const own = id ? sources.filter((source) => source.toLowerCase().includes(`extensionid=${id}`)) : sources;
  let screenshot = "";
  if (run.options.screenshotDir) {
    await mkdir(run.options.screenshotDir, { recursive: true });
    const path = join(resolve(run.options.screenshotDir), screenshotFileName(run.name, OPEN_FAILURE));
    screenshot = await context.page.screenshot({ path, scale: "css" }).then(
      () => `, screenshot ${path}`,
      () => "",
    );
  }
  return `(${sources.length} webview frames in the workbench, ${own.length} of ${run.extensionId ?? "the extension"}${screenshot})`;
}

interface ThemeCheckOptions {
  themes: readonly Theme[];
  islands: readonly ChromeIsland[];
  timeoutMs: number;
  writeSettings: (colorTheme: string) => Promise<void>;
  screenshotDir: string | undefined;
  name: string;
}

async function checkTheme(
  context: VsCodeSmokeContext,
  theme: VsCodeColorTheme,
  options: ThemeCheckOptions,
): Promise<{ result: VsCodeSmokeThemeResult; failures: string[] }> {
  const since = performance.now();
  const failures: string[] = [];
  const html = context.webview.locator("html");
  const expected = expectedWebviewAppearance(theme.kind, options.themes);
  const bodyClasses = [...webviewBodyClasses(theme.kind)].sort().join(" ");

  // VS Code watches its settings file: the theme changes the way a user's setting change does.
  await options.writeSettings(theme.name);
  const workbench = await pollUntil(
    () => context.page.evaluate(workbenchThemeProbe, workbenchThemeClass(theme.kind)),
    (switched) => switched,
    options.timeoutMs,
  );
  let facts: WebviewThemeFacts | undefined;
  if (!workbench.met) {
    failures.push(`${theme.name}: the workbench never switched (no .${workbenchThemeClass(theme.kind)})`);
  } else {
    const shown = await pollUntil(
      () => html.evaluate(webviewThemeProbe, WEBVIEW_THEME_BODY_CLASSES),
      (value) =>
        value.bodyClasses.join(" ") === bodyClasses &&
        !value.switching &&
        sameAppearance(expected, appearanceOf(value)),
      options.timeoutMs,
    );
    facts = shown.value;
    if (facts.bodyClasses.join(" ") !== bodyClasses) {
      failures.push(
        `${theme.name}: the webview's body has "${facts.bodyClasses.join(" ")}", VS Code's classes are "${bodyClasses}"`,
      );
    } else if (!sameAppearance(expected, appearanceOf(facts))) {
      failures.push(
        `${theme.name}: the webview shows ${describeAppearance(appearanceOf(facts))}, ` +
          `the theme bridge has to show ${describeAppearance(expected)}`,
      );
    }
  }
  await settle(context);
  const chrome: ChromePresence = await html.evaluate(chromeProbe, options.islands);
  const missing = missingChrome(options.islands, chrome);
  if (missing) failures.push(`${theme.name}: ${missing}`);

  let screenshot: string | undefined;
  if (options.screenshotDir && workbench.met) {
    await mkdir(options.screenshotDir, { recursive: true });
    screenshot = join(resolve(options.screenshotDir), screenshotFileName(options.name, theme));
    // CSS pixels: the same image size on a Retina Mac and on a CI runner
    await context.page.screenshot({ path: screenshot, scale: "css" });
  }
  return {
    result: {
      theme,
      expected,
      observed: facts ? appearanceOf(facts) : undefined,
      bodyClasses: facts?.bodyClasses ?? [],
      chrome,
      screenshot,
      ms: elapsed(since),
      ok: failures.length === 0,
    },
    failures,
  };
}
