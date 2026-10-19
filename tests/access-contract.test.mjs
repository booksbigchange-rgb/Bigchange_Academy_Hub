import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const policy = readFileSync(new URL('../supabase/policies/academy_profile_access.sql', import.meta.url),'utf8');
const schema = readFileSync(new URL('../supabase/migrations/20261015_0001_locked_schema.sql',import.meta.url),'utf8');
test('initial schema remains locked and denies client writes', () => {
  const tables = [...schema.matchAll(/create table if not exists public\.(academy_[a-z_]+)\(/g)].map(x=>x[1]);
  assert.equal(tables.length,14);
  for (const table of tables) {
    assert.ok(schema.includes('alter table public.'+table+' enable row level security;'),table);
    assert.ok(schema.includes('alter table public.'+table+' force row level security;'),table);
    assert.ok(policy.includes('public.'+table), table);
  }
  assert.match(policy,/revoke all on table[\s\S]*from anon, authenticated;/i);
});
test('only own member identities are readable; no broad grants', () => {
  const grants=[...policy.matchAll(/grant\s+(select|insert|update|delete)[\s\S]*?to authenticated;/gi)];
  assert.equal(grants.length,1);
  assert.match(grants[0][0],/^grant select/i);
  assert.equal((policy.match(/create policy academy_\w+_self_select/g)||[]).length,3);
  assert.equal((policy.match(/using \(auth_user_id = \(select auth\.uid\(\)\)\)/g)||[]).length,3);
  assert.doesNotMatch(policy,/create policy[\s\S]*?for\s+(all|insert|update|delete)/i);
  assert.doesNotMatch(policy,/using\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(policy.split('\n').filter(line=>!line.trimStart().startsWith('--')).join('\n'),/raw_user_meta_data|user_metadata/i);
});
test('sign-in gate never falls through into demo after configuration',()=>{
  const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
  const auth=readFileSync(new URL('../src/SecureApp.tsx',import.meta.url),'utf8');
  assert.match(main,/config\s*\?\s*<Suspense/);
  assert.match(auth,/auth\.getUser\(\)/);
  assert.match(auth,/\.eq\('auth_user_id', userId\)/);
  assert.doesNotMatch(auth,/\.auth\.signUp\(/);
});

test('adult-only pilot does not use public user self-registration or service keys', () => {
  const source=readFileSync(new URL('../src/pilot-main.tsx',import.meta.url),'utf8');
  const auth=readFileSync(new URL('../src/SecureApp.tsx',import.meta.url),'utf8');
  const vite=readFileSync(new URL('../vite.config.ts',import.meta.url),'utf8');
  assert.match(source,/sb_publishable_/);
  assert.match(source,/nwpaqjzwqwkqxibwvusr/);
  assert.doesNotMatch(source,/signUp\(/);
  assert.match(auth,/detectSessionInUrl: true/);
  assert.match(auth,/auth\.updateUser\(\{ password \}\)/);
  assert.match(vite,/pilot\.html/);
});
test('test-admin provisioning refuses a missing email and other role reassignments',()=>{
  const sql=readFileSync(new URL('../supabase/manual/provision_test_admin.sql',import.meta.url),'utf8');
  assert.match(sql,/target_email = 'REPLACE_WITH_CONFIRMED_ADULT_TEST_EMAIL@example.com'/);
  assert.match(sql,/email_confirmed_at IS NOT NULL/);
  assert.match(sql,/ON CONFLICT \(auth_user_id\) DO NOTHING/);
  assert.match(sql,/academy_guardians/);
  assert.match(sql,/academy_learners/);
  assert.doesNotMatch(sql,/service_role|auth\.admin\.createUser/i);
});

test('public prototype provides skip navigation, named breadcrumbs and accessible mobile section navigation',()=>{
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
  assert.match(app,/href="#main-content">Skip to main content<\\/a>/);
  assert.match(app,/<main className="content" id="main-content" tabIndex=\\{-1\\}>/);
  assert.match(app,/<span className="navicon" aria-hidden="true">/);
  assert.match(app,/<nav className="crumb" aria-label="Breadcrumb">/);
  assert.match(app,/nav-scroll-hint/);
  assert.match(css,/\\.skip-link:focus/);
  assert.match(css,/@media\\(max-width:790px\\)[\\s\\S]*?\\.nav-scroll-hint/);
});
