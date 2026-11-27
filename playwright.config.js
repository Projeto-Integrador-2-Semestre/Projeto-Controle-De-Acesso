import { defineConfig, devices } from '@playwright/test';

// Testes de navegador (npm run test:e2e).
// O Vite sobe apontando para uma API falsa (http://api.e2e.test), que cada teste
// simula com page.route (ver e2e/apiFalsa.js). Não precisa da API Java nem do banco.
const PORTA = 5181;
const API_FALSA = 'http://api.e2e.test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORTA}`,
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } } }],
  webServer: {
    command: `npx vite --port ${PORTA} --strictPort`,
    url: `http://localhost:${PORTA}`,
    reuseExistingServer: !process.env.CI,
    env: { VITE_API_URL: API_FALSA, VITE_USE_MOCK: 'false' },
  },
});
