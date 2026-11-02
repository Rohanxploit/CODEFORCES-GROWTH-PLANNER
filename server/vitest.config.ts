import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/cgp-test',
      AUTH_RATE_LIMIT: '1000',
    },
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
