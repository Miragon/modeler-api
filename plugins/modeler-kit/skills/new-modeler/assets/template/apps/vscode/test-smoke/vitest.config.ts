import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Not in `npm test`: it needs a display and the built extension, and two runs that download the
// same VS Code at once would write into the same cache.
export default defineConfig({
  test: {
    root: fileURLToPath(new URL('../../..', import.meta.url)),
    include: ['apps/vscode/test-smoke/*.test.ts'],
    fileParallelism: false,
  },
});
