import { expect, type Locator, type Page } from "@playwright/test";
import type { ShellHandle } from "@miragon/modeler-shell";
import type { DiagramJsConnection } from "@miragon/modeler-shell/diagram-js";
import { serializeDocumentText, type CmDocument } from "@miragon/context-maps-schema-model";
import { encodeDocumentToHash } from "../../../apps/webapp/src/io/url.js";

/**
 * Structural handle to the app's debug surface (published in apps/webapp/src/main.ts). The specs
 * never import the renderer, only the shape they call into.
 */
export interface MapExport {
  readonly title: string;
  readonly contexts: ReadonlyArray<{ id: string; label: string; subdomainType?: string }>;
  readonly relationships: ReadonlyArray<{
    id: string;
    from: string;
    to: string;
    pattern: string;
  }>;
}

export interface CmModeler {
  importDocument(doc: unknown): { warnings: ReadonlyArray<unknown> };
  exportDocument(): MapExport;
  saveSVG(): { svg: string };
  get<T>(name: string): T;
}

/** The web app's parts, published once its first map is in place. */
export interface ContextMapsApp {
  readonly ready: boolean;
  readonly shell: ShellHandle;
  readonly connection: DiagramJsConnection;
  destroy(): void;
}

declare global {
  interface Window {
    __cmModeler: CmModeler;
    __contextMapsApp?: ContextMapsApp;
  }
}

/** The app's path for a link that carries `doc`, as Share writes it. */
export function mapLink(doc: unknown): string {
  return `/#d=${encodeDocumentToHash(doc as CmDocument)}`;
}

/** Waits until the app has started: its first map (the link's, the stored one or an empty one) is in place. */
export async function waitForApp(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__contextMapsApp?.ready === true);
}

/** Opens the app on a link to `doc`: the map opens at once, fitted, without the start screen. */
export async function openMap(page: Page, doc: unknown): Promise<void> {
  await page.goto(mapLink(doc));
  await waitForApp(page);
}

/** The start screen's card (the shell's empty state). */
export function startScreen(page: Page): Locator {
  return page.locator('[data-chrome="empty-state"]');
}

/** Opens the app on its start screen and loads the example from there. */
export async function openExample(page: Page): Promise<void> {
  await page.goto("/");
  await waitForApp(page);
  await startScreen(page).getByRole("button", { name: "Show example" }).click();
  await expect(page.locator(".cd-shell-canvas .djs-element").first()).toBeVisible();
}

/** Opens the chrome menu and returns its dropdown. */
export async function openMenu(page: Page): Promise<Locator> {
  await page.locator('[data-chrome="menu"]').click();
  const dropdown = page.locator(".cd-shell-menu[role='menu']");
  await expect(dropdown).toBeVisible();
  return dropdown;
}

/** A diagram element on the canvas by its id. */
export function element(page: Page, id: string): Locator {
  return page.locator(`.cd-shell-canvas [data-element-id="${id}"]`);
}

export function exportMap(page: Page): Promise<MapExport> {
  return page.evaluate(() => window.__cmModeler.exportDocument());
}

/** The map as its canonical file text: equal maps compare equal whatever order the canvas holds. */
export async function mapText(page: Page): Promise<string> {
  return serializeDocumentText((await exportMap(page)) as unknown as CmDocument);
}

export function relationships(page: Page): Promise<MapExport["relationships"]> {
  return page.evaluate(() => window.__cmModeler.exportDocument().relationships);
}

/** A toast of the shell's stack with `text`. */
export function toast(page: Page, text: string | RegExp): Locator {
  return page.locator('[data-chrome="toasts"] .cd-shell-toast').filter({ hasText: text });
}
