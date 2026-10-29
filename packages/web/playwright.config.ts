import { defineConfig } from '@playwright/test';

// End-to-end test: speelt in de gebouwde site (zonder debugmenu) een volledig spel met vaste seed.
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1366, height: 768 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
