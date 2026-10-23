import { expect, test } from '@playwright/test';
import { vsCodeStubSearch } from '@miragon/modeler-shell/testing';

/**
 * In VS Code "?" opens the keyboard shortcuts as in the web app, and like every key the webview
 * handles it never reaches VS Code's listener on `window` (guide §13.5).
 */
test('VS Code webview: "?" opens the keyboard shortcuts and never reaches VS Code', async ({
  page,
}) => {
  await page.goto(`/webview-test.html?${vsCodeStubSearch({ theme: 'light' })}`);
  await page.waitForFunction(() => window.webviewReady === true);
  await page.evaluate(() => {
    const keys: string[] = [];
    Object.assign(window, { keysAtWindow: keys });
    window.addEventListener('keydown', (event) => keys.push(event.key));
  });

  const canvas = page.locator('.djs-container > svg');
  await canvas.focus();
  await page.keyboard.press('?');
  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(canvas).toBeFocused();
  const keys = await page.evaluate(
    () => (window as unknown as { keysAtWindow: string[] }).keysAtWindow,
  );
  expect(keys).not.toContain('?');
});
