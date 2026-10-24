/** One error the extension's webview reported. */
export interface WebviewError {
  /** The message with its stack, as Chromium reports it. */
  text: string;
  /** `performance.now()` when the driver got it. */
  at: number;
}

/** The errors of one kind: how many came and the first `WEBVIEW_ERRORS_SHOWN`. */
export interface WebviewErrorKind {
  count: number;
  first: WebviewError[];
}

/** The part of Playwright's `ConsoleMessage` the watch reads. */
export interface WebviewConsoleMessage {
  type(): string;
  text(): string;
  location(): { url: string; lineNumber: number; columnNumber: number };
}

/** The part of Playwright's `Page` the watch listens on. */
export interface WebviewErrorEvents {
  on(event: "console", listener: (message: WebviewConsoleMessage) => void): unknown;
  on(event: "pageerror", listener: (error: Error) => void): unknown;
  off(event: "console", listener: (message: WebviewConsoleMessage) => void): unknown;
  off(event: "pageerror", listener: (error: Error) => void): unknown;
}

/** Whose webview the errors have to come from. */
export interface WebviewOwner {
  /** `publisher.name`, which VS Code puts into the URL of the extension's webview documents. */
  extensionId: string | undefined;
  /** The extension's folder, as given and as its real path, whose files the webview loads. */
  extensionFolders: readonly string[];
}

export interface WebviewErrorWatch {
  /** Uncaught exceptions and unhandled rejections (Playwright's `pageerror`). */
  uncaught: WebviewErrorKind;
  /** `console.error` calls and Chromium's own errors (a resource that did not load, a CSP block). */
  console: WebviewErrorKind;
  stop(): void;
}

export const WEBVIEW_ERRORS_SHOWN = 3;
const LINES_PER_ERROR = 12;
const CHARACTERS_PER_LINE = 500;
const RESOURCE_HOST_SUFFIX = ".vscode-resource.vscode-cdn.net";
const STACK_LINE = /^\s+at /;
const URL_IN_LINE = /[a-z][a-z\d+.-]*:\/\/[^\s()]+/i;

// VS Code's URIs write a Windows drive as `/c:/…`, Node as `C:\…`.
function comparablePath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .replace(/^\/(?=[a-z]:)/i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

/**
 * Whether `url` belongs to the extension's webview: one of its documents
 * (`vscode-webview://<origin>/index.html?…&extensionId=<id>&…`, the extension id compared
 * case-insensitively) or a file of its folder that the webview loaded
 * (`https://file+.vscode-resource.vscode-cdn.net/<folder>/dist/webview.js`).
 */
export function isOwnWebviewUrl(url: string, owner: WebviewOwner): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol === "vscode-webview:") {
    const id = parsed.searchParams.get("extensionId");
    return (
      id !== null &&
      owner.extensionId !== undefined &&
      id.toLowerCase() === owner.extensionId.toLowerCase()
    );
  }
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(RESOURCE_HOST_SUFFIX)) return false;
  let path: string;
  try {
    path = comparablePath(decodeURIComponent(parsed.pathname));
  } catch {
    return false;
  }
  return owner.extensionFolders.some((folder) => {
    const prefix = comparablePath(folder);
    return path === prefix || path.startsWith(`${prefix}/`);
  });
}

/** The URL of a stack's topmost frame without line and column; undefined when it has none. */
export function topStackUrl(stack: string): string | undefined {
  for (const line of stack.split("\n")) {
    if (!STACK_LINE.test(line)) continue;
    const url = URL_IN_LINE.exec(line)?.[0];
    if (url) return url.replace(/(?::\d+){1,2}$/, "");
  }
  return undefined;
}

function hasStack(text: string): boolean {
  return text.split("\n").some((line) => STACK_LINE.test(line));
}

function uncaughtText(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  if (error.stack?.trim()) return error.stack;
  return [error.name, error.message].filter(Boolean).join(": ");
}

function record(kind: WebviewErrorKind, text: string): void {
  kind.count++;
  if (kind.first.length < WEBVIEW_ERRORS_SHOWN) kind.first.push({ text, at: performance.now() });
}

/**
 * Collects what the extension's webview reports on `page` until `stop`: Playwright reports the
 * `console` messages and the `pageerror`s of every frame on the page, VS Code's webview frames
 * included. A console error counts when its location is the extension's (`isOwnWebviewUrl`), an
 * uncaught error when the topmost frame of its stack is; the workbench's own errors and those of
 * other extensions' webviews do not.
 */
export function watchWebviewErrors(
  page: WebviewErrorEvents,
  owner: WebviewOwner,
): WebviewErrorWatch {
  const watch: WebviewErrorWatch = {
    uncaught: { count: 0, first: [] },
    console: { count: 0, first: [] },
    stop() {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
    },
  };
  function onConsole(message: WebviewConsoleMessage): void {
    if (message.type() !== "error") return;
    const { url, lineNumber, columnNumber } = message.location();
    if (!isOwnWebviewUrl(url, owner)) return;
    const text = message.text();
    // A resource that failed to load has no stack: its location is all that names it.
    record(
      watch.console,
      hasStack(text) ? text : `${text}\n    at ${url}:${lineNumber + 1}:${columnNumber + 1}`,
    );
  }
  function onPageError(error: unknown): void {
    const text = uncaughtText(error);
    const url = topStackUrl(text);
    if (url !== undefined && isOwnWebviewUrl(url, owner)) record(watch.uncaught, text);
  }
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  return watch;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function clip(line: string): string {
  return line.length > CHARACTERS_PER_LINE ? `${line.slice(0, CHARACTERS_PER_LINE)} …` : line;
}

function describeError(label: string, text: string): string {
  const lines = text.split(/\r?\n/);
  const shown = lines.slice(0, LINES_PER_ERROR).map(clip);
  if (lines.length > LINES_PER_ERROR) shown.push("…");
  return shown
    .map((line, index) => (index === 0 ? `    ${label} ${line}` : `    ${line}`))
    .join("\n");
}

/**
 * The webview's errors for a failure message, one indented block per error with its stack: the
 * uncaught ones first, then the console errors, `WEBVIEW_ERRORS_SHOWN` in all, each kind in the
 * order it came; an empty string when there were none.
 */
export function describeWebviewErrors(
  watch: Pick<WebviewErrorWatch, "uncaught" | "console">,
): string {
  const { uncaught, console: logged } = watch;
  const total = uncaught.count + logged.count;
  if (total === 0) return "";
  const counts = [
    uncaught.count > 0 ? plural(uncaught.count, "uncaught error") : "",
    logged.count > 0 ? plural(logged.count, "console error") : "",
  ].filter(Boolean);
  const blocks = [
    ...uncaught.first.map((error) => describeError("uncaught", error.text)),
    ...logged.first.map((error) => describeError("console.error:", error.text)),
  ].slice(0, WEBVIEW_ERRORS_SHOWN);
  const more = total - blocks.length;
  return [
    `the webview reported ${counts.join(" and ")}:`,
    ...blocks,
    ...(more > 0 ? [`    and ${more} more`] : []),
  ].join("\n");
}
