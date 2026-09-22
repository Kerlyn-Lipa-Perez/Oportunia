import { defineConfig, devices } from '@playwright/test';
import { resolveExternalBaseUrl } from './e2e/config';

const baseURL = resolveExternalBaseUrl(process.env);

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
