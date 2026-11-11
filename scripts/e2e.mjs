// One command for the browser test: starts the app against a FAKE Supabase address (nothing real is contacted),
// runs tests/e2e/live-smoke.mjs with the accessibility scan, then stops the app.
// Usage: npm run test:e2e        Optional: E2E_CHROMIUM=/path/to/chrome to use an already installed Chromium.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

process.env.VITE_ACADEMY_SUPABASE_URL = 'https://smoketest.supabase.co';
process.env.VITE_ACADEMY_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_smoketest';
const port = Number(process.env.E2E_PORT || 5199);
const server = await createServer({ server: { port, strictPort: true, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const axe = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const args = ['tests/e2e/live-smoke.mjs', `http://127.0.0.1:${port}`];
if (process.env.E2E_CHROMIUM) args.push(process.env.E2E_CHROMIUM);
const code = await new Promise(resolve => spawn(process.execPath, args, { stdio: 'inherit', env: { ...process.env, AXE_PATH: axe } }).on('exit', resolve));
await server.close();
process.exit(code ?? 1);
