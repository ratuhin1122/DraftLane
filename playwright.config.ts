import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e',
  timeout:45000,
  retries:0,
  workers:1,
  reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:process.env.E2E_BASE_URL || 'http://localhost:3001',trace:'retain-on-failure',screenshot:'only-on-failure',browserName:'chromium'},
});
