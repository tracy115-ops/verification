import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['tests/runtime/**/*.integration.test.ts'], fileParallelism: false, testTimeout: 60000 },
});
