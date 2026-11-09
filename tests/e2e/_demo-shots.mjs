// Screenshots of the demo app (no .env values) to prove the live-app restyle leaves it unchanged.
import { chromium } from 'playwright';
const [base, exec, out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: exec });
for (const [w, h] of [[1366, 900], [390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto(base); await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/demo-${w}.png`, fullPage: true });
  const roles = p.locator('select').first();
  if (await roles.count()) { await roles.selectOption({ index: 2 }).catch(() => {}); await p.waitForTimeout(400); await p.screenshot({ path: `${out}/demo-${w}-role2.png`, fullPage: true }); }
  await p.close();
}
await b.close();
