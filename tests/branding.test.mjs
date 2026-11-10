import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const text=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('uploaded Academy logo is referenced through the deployment base path',()=>{
 const app=text('src/App.tsx'),index=text('index.html'),logo=text('public/bigchange-academy-logo.svg');
 assert.match(app,/import\.meta\.env\.BASE_URL/);
 assert.match(app,/alt="BigChange Academy"/);
 assert.match(index,/%BASE_URL%bigchange-academy-logo\.svg/);
 assert.match(logo,/<svg[^>]*viewBox=/);
 assert.match(logo,/<title id="t">BigChange Academy<\/title>/);
 assert.doesNotMatch(logo,/<script|href="http/i);
});
test('warm brand tokens and accessible selected navigation are present',()=>{
 const app=text('src/App.tsx'),styles=text('src/styles.css');
 for(const token of ['--bg-main:', '--sidebar:', '--gold:', '.brand-logo', '.navitem.active']) assert.ok(styles.includes(token),token);
 assert.match(app,/aria-current=/);
});
