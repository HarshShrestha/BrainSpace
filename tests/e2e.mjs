// Exercise built assets against the real API and an isolated temporary MongoDB.
import { MongoMemoryServer } from 'mongodb-memory-server';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import net from 'node:net';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
async function freePort() { return await new Promise((resolve, reject) => { const server = net.createServer(); server.on('error', reject); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); }); }
const apiPort = await freePort(), webPort = await freePort();
const baseUrl = `http://127.0.0.1:${webPort}`;
const mongo = await MongoMemoryServer.create();
const env = { ...process.env, MONGODB_URI: mongo.getUri('brainspace_e2e'), ACCESS_TOKEN_SECRET: 'test-only-secret-with-at-least-32-characters', CORS_ORIGIN: baseUrl, PORT: String(apiPort), NODE_ENV: 'production', E2E_API_PROXY: `http://127.0.0.1:${apiPort}` };
const backend = spawn(process.execPath, ['dist/index.js'], { env, stdio: 'inherit' });
const frontend = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'], { env, cwd: 'frontend', stdio: 'inherit' });
frontend.on('error', console.error);
let browser;
try {
  for (let i=0; i<80; i++) { try { if ((await fetch(`http://127.0.0.1:${apiPort}/api/health`)).ok && (await fetch(baseUrl)).ok) break; } catch {} if (i===79) throw new Error('Servers did not start'); await delay(250); }
  browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage(); page.on('dialog', dialog => dialog.accept());
  await page.goto(baseUrl);
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Username').fill('reader'); await page.getByLabel('Password').fill('strong-example-password');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('button', { name: /Add content/ }).waitFor();
  await page.getByRole('button', { name: /Add content/ }).click();
  await page.getByLabel('Title').fill('Designing a calmer internet'); await page.getByLabel('Link').fill('https://example.com/design'); await page.getByLabel(/Tags/).fill('design, inspiration');
  await page.getByRole('button', { name: 'Save to space' }).click();
  await page.getByRole('link', { name: /Designing a calmer internet/ }).waitFor();
  if (process.env.SCREENSHOT_DIR) { await mkdir(process.env.SCREENSHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'workspace.png'), fullPage: true }); }
  await page.getByLabel('Search your content').fill('inspiration'); assert.equal(await page.getByRole('link', { name: /Designing a calmer internet/ }).count(),1);
  await page.getByLabel('Search your content').fill('missing'); await page.getByText('No items match your search or filter.').waitFor(); await page.getByLabel('Search your content').fill('');
  await page.getByRole('button', { name: /Share/ }).click(); await page.getByRole('button', { name: 'Create link', exact: true }).click();
  const url = await page.getByLabel('Share link').inputValue();
  const other = await browser.newContext(); const visitor = await other.newPage(); await visitor.goto(url); await visitor.getByRole('link', { name: /Designing a calmer internet/ }).waitFor();
  await page.getByRole('button', { name: 'Revoke link' }).click(); await visitor.reload(); await visitor.getByRole('alert').waitFor(); await other.close();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.setViewportSize({ width: 390, height: 844 }); if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'mobile.png'), fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth); assert.equal(overflow, false, 'Mobile layout should not overflow horizontally');
  await page.getByRole('button', { name: 'Delete Designing a calmer internet' }).click(); await page.getByText('Nothing here yet. Save a link to start building your space.').waitFor();
  await page.getByRole('button', { name: 'Sign out' }).click(); await page.getByLabel('Username').fill('reader'); await page.getByLabel('Password').fill('strong-example-password'); await page.getByRole('button', { name: /Sign in/ }).first().click(); await page.getByRole('button', { name: /Add content/ }).waitFor();
  console.log('E2E passed: signup, capture, search, share, revoke, delete, sign-out, sign-in and mobile layout.');
} finally { await browser?.close(); backend.kill(); frontend.kill(); await mongo.stop(); }
