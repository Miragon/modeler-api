import type { Page } from "@playwright/test";
import type { Appearance } from "@miragon/modeler-shell";
import { vsCodeStubSearch } from "@miragon/modeler-shell/testing";

export const LIGHT: Appearance = { theme: "light" };
export const WIDE = { width: 1280, height: 900 } as const;

export interface OpenOptions {
  size?: { width: number; height: number };
  requested?: Appearance;
  map?: "example" | "empty";
  /** Open from the start, as the webview state restores a legend the user left open. */
  legend?: "open";
}

/** Opens the webview as VS Code would and resolves once the first `init` import has settled. */
export async function openWebview(page: Page, options: OpenOptions = {}): Promise<void> {
  await page.setViewportSize(options.size ?? WIDE);
  const search = new URLSearchParams(vsCodeStubSearch(options.requested ?? LIGHT));
  if (options.map === "empty") search.set("map", "empty");
  if (options.legend) search.set("legend", options.legend);
  await page.goto(`/webview-test.html?${search.toString()}`);
  await page.waitForFunction(() => window.webviewReady === true);
}

export interface PostedMessage {
  type: string;
  [key: string]: unknown;
}

/** Everything the webview posted to the extension host so far. */
export function postedMessages(page: Page): Promise<PostedMessage[]> {
  return page.evaluate(
    () => [...(window.__modelerShellVsCodeStub?.posted ?? [])] as PostedMessage[],
  );
}

/** Waits until the webview posted a message of `type` and returns the last one. */
export async function waitForPosted(page: Page, type: string): Promise<PostedMessage> {
  await page.waitForFunction(
    (wanted) =>
      (window.__modelerShellVsCodeStub?.posted ?? []).some(
        (message) => (message as { type?: unknown }).type === wanted,
      ),
    type,
  );
  const messages = await postedMessages(page);
  return messages.filter((message) => message.type === type).at(-1)!;
}

/** Delivers a host message the way VS Code does: a `message` event on the webview's window. */
export async function postFromHost(page: Page, message: PostedMessage): Promise<void> {
  await page.evaluate((data) => window.postMessage(data, "*"), message);
}

/** A text the parser rejects, as a peer leaves the file while typing. */
export const INVALID_MAP = '{ "version": 1, "title": "Broken", "contexts": [';
