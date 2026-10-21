import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

// `npm test` stays fast and node-only; the renderer's integration layer, the modeler-api
// conformance kit included, runs in real Chromium (`npm run test:browser`): jsdom has no
// SVGElement.getBBox(), which diagram-js needs for every viewbox.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts'],
          exclude: ['packages/renderer/test/browser/**', '**/node_modules/**', '**/dist/**'],
        },
      },
      {
        test: {
          name: 'browser',
          include: ['packages/renderer/test/browser/**/*.test.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
