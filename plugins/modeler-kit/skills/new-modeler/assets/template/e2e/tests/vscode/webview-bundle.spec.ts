import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { build } from 'esbuild';
import { expect, test } from '@playwright/test';
import { renderWebviewHtml } from '@miragon/modeler-shell/vscode/extension';
import { EXAMPLE_DIAGRAM } from '../../../apps/vscode/src/examples.js';

/**
 * The shipped bundle as VS Code loads it: the production build of apps/vscode behind the HTML and
 * CSP of renderWebviewHtml. The other specs run the webview from source without a CSP, so a
 * loader or CSP mistake of the esbuild bundle shows only here.
 */
const repository = fileURLToPath(new URL('../../..', import.meta.url));
const dist = join(repository, 'apps/vscode/dist');
const ORIGIN = 'https://webview.test';
const NONCE = 'c21va2V0ZXN0bm9uY2Uw';

let stubScript = '';

test.beforeAll(async () => {
  test.setTimeout(120_000);
  await promisify(execFile)(process.execPath, ['esbuild.config.mjs', '--production'], {
    cwd: join(repository, 'apps/vscode'),
  });
  // What VS Code provides around the webview, plus a recorder of CSP violations.
  const stub = await build({
    stdin: {
      contents: `
        import { installVsCodeWebviewStub } from '@miragon/modeler-shell/testing/vscode-stub';
        window.cspViolations = [];
        document.addEventListener('securitypolicyviolation', (event) =>
          window.cspViolations.push(event.violatedDirective + ' ' + event.blockedURI),
        );
        installVsCodeWebviewStub({ requested: { theme: 'light' }, themes: ['light'] });
      `,
      resolveDir: join(repository, 'e2e'),
      loader: 'ts',
    },
    bundle: true,
    format: 'iife',
    write: false,
    logLevel: 'silent',
  });
  stubScript = stub.outputFiles[0]!.text;
});

test('the production bundle runs under the webview CSP', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/') {
      const html = renderWebviewHtml({
        cspSource: ORIGIN,
        nonce: NONCE,
        scriptUri: `${ORIGIN}/webview.js`,
        styleUris: [`${ORIGIN}/webview.css`],
        title: '__DISPLAY_NAME__',
        lang: 'en',
        appearance: { theme: 'light' },
        body: `<div id="app"></div><script nonce="${NONCE}" src="${ORIGIN}/stub.js"></script>`,
      });
      return route.fulfill({ contentType: 'text/html', body: html });
    }
    if (pathname === '/stub.js') {
      return route.fulfill({ contentType: 'text/javascript', body: stubScript });
    }
    return route.fulfill({ path: join(dist, pathname) });
  });
  await page.goto(`${ORIGIN}/`);
  await page.evaluate((text) => window.postMessage({ type: 'init', text }, '*'), EXAMPLE_DIAGRAM);
  await expect(page.locator('.djs-shape')).not.toHaveCount(0);
  await page.locator('[data-chrome="menu"]').click();
  expect(await page.evaluate(() => (window as { cspViolations?: string[] }).cspViolations)).toEqual(
    [],
  );
  expect(errors).toEqual([]);
});
