import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Exclude old node:test file and compiled output
    exclude: [
      'node_modules',
      'dist/**',
      'src/tests/consultations.test.ts',
    ],
  },
});
