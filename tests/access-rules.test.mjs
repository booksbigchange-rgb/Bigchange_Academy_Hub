import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261031_0002_access_rules.sql',import.meta.url),'utf8');
const schema=readFileSync(new URL('../supabase/migrations/20261015_0001_locked_schema.sql',import.meta.url),'utf8');
const code=sql.split('\n').filter(l=>!l.trimStart().startsWith('--')).join('\n');
const tables=[...schema.matchAll(/create table if not exists public\.(academy_[a-z_]+)\(/g)].map(x=>x[1]);
test('every Academy table has at least one policy and no anon grants',()=>{
  for(const t of tables)assert.ok(new RegExp('create policy \\w+ on public\\.'+t+' for').test(code),t);
  assert.doesNotMatch(code,/grant[^;]*\bto\b[^;]*\banon\b/i);
  assert.match(code,/revoke all on table[\s\S]*from anon, authenticated;/i);
});
test('no open or metadata-based authorization',()=>{
  assert.doesNotMatch(code,/using\s*\(\s*true\s*\)|with check\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(code,/user_metadata|raw_user_meta_data|service_role/i);
  assert.doesNotMatch(code,/for all\b/i);
});
test('all security-definer functions pin search_path',()=>{
  const defs=code.split(/create or replace function/i).slice(1);
  assert.ok(defs.length>=14);
  for(const d of defs)if(/security definer/i.test(d))assert.match(d,/set search_path = ''/);
});
test('records are never deleted by clients; audit is append-only',()=>{
  for(const t of ['academy_learners','academy_guardians','academy_fee_obligations','academy_external_payments','academy_audit_events'])
    assert.doesNotMatch(code,new RegExp('create policy \\w+ on public\\.'+t+' for delete'));
  assert.doesNotMatch(code,/create policy \w+ on public\.academy_audit_events for (insert|update|delete)/);
  assert.match(code,/create trigger academy_audit_payments/);
});
test('attendance requires enrollment and the recording staff identity; payments cannot be self-verified on insert',()=>{
  const att=code.match(/create policy academy_attendance_insert[\s\S]*?;/)[0];
  assert.match(att,/academy_learner_in_class/);assert.match(att,/recorded_by_staff_id = public\.academy_staff_id\(\)/);
  const pay=code.match(/create policy academy_payments_insert[\s\S]*?;/)[0];
  assert.match(pay,/verified_by_staff_id is null/);
});
test('fee status view runs with caller rights and uses Overdue policy',()=>{
  assert.match(code,/security_invoker = true/);assert.match(code,/'overdue'/);
});
