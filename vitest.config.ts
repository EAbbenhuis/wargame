import { defineConfig } from 'vitest/config';

// Eén testcommando voor de hele repo: elke package heeft een eigen vitest-config.
export default defineConfig({
  test: {
    projects: ['packages/*'],
  },
});
