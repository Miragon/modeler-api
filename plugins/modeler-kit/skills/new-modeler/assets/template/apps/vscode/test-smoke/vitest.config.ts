import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Not in `npm test`: it needs a display and the built extension.
export default defineConfig({
  test: {
    root: fileURLToPath(new URL('../../..', import.meta.url)),
    include: ['apps/vscode/test-smoke/*.test.ts'],
    fileParallelism: false,
  },
});
