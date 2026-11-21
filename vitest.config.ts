import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DB_PATH: ':memory:',
      API_KEY: 'test-api-key-0123456789',
      OPENAI_API_KEY: 'test',
    },
  },
});
