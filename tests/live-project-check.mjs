// Role check against the REAL Academy Supabase project. Run on your own computer, with TEST accounts only.
// It signs in as each role you provide and checks what that role can and cannot do. It only READS, plus
// a few writes that MUST be refused (nothing is created or changed when the rules are correct).
// Passwords are read from environment variables and never printed or saved.
//
// Windows (cmd), in the project folder:
//   set ADMIN_EMAIL=you@example.com&& set ADMIN_PASSWORD=...
//   set TEACHER_EMAIL=teacher@example.com&& set TEACHER_PASSWORD=...
//   set FINANCE_EMAIL=...&& set FINANCE_PASSWORD=...      (optional)
//   node tests/live-project-check.mjs
// Afterwards close the window so the passwords are not left in it.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)
  .map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2]]));
const URL_ = env.VITE_ACADEMY_SUPABASE_URL, KEY = env.VITE_ACADEMY_SUPABASE_PUBLISHABLE_KEY;
if (!URL_ || !KEY) { console.error('Missing .env with VITE_ACADEMY_SUPABASE_URL and VITE_ACADEMY_SUPABASE_PUBLISHABLE_KEY'); process.exit(2); }

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || !detail ? '' : ' — ' + detail)); };
const client = () => createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const count = async (c, table) => { const { data, error } = await c.from(table).select('*', { head: false }).limit(1000); return error ? -1 : data.length; };
const refused = r => Boolean(r.error) || (Array.isArray(r.data) && r.data.length === 0);

async function signIn(role) {
  const email = process.env[role + '_EMAIL'], password = process.env[role + '_PASSWORD'];
  if (!email || !password) { console.log(`SKIP ${role.toLowerCase()}: set ${role}_EMAIL and ${role}_PASSWORD to test this role`); return null; }
  const c = client();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  check(`${role.toLowerCase()} can sign in`, !error, error?.message);
  if (error) return null;
  const staff = await c.from('academy_staff').select('role').eq('auth_user_id', data.user.id).maybeSingle();
  check(`${role.toLowerCase()} has role "${role.toLowerCase()}"`, staff.data?.role === role.toLowerCase(), staff.error?.message ?? 'found: ' + (staff.data?.role ?? 'no staff role'));
  return c;
}

// Anonymous: nothing visible
const anon = client();
for (const t of ['academy_learners', 'academy_guardians', 'academy_fee_periods', 'academy_attendance'])
  check(`not signed in: ${t} is hidden`, (await anon.from(t).select('*').limit(1)).error !== null);

const admin = await signIn('ADMIN');
let adminCounts = null;
if (admin) {
  adminCounts = {};
  for (const t of ['academy_learners', 'academy_classes', 'academy_guardians', 'academy_fee_periods', 'academy_audit_events'])
    { adminCounts[t] = await count(admin, t); check(`admin can read ${t} (${adminCounts[t]} rows)`, adminCounts[t] >= 0); }
}

const teacher = await signIn('TEACHER');
if (teacher) {
  check('teacher cannot read the fee table', (await count(teacher, 'academy_fee_periods')) <= 0);
  check('teacher cannot read the guardians table', (await count(teacher, 'academy_guardians')) <= 0);
  check('teacher cannot read the audit trail', (await count(teacher, 'academy_audit_events')) <= 0);
  check('teacher cannot see staff list beyond self', (await count(teacher, 'academy_staff')) === 1);
  if (adminCounts) check('teacher sees no more students than admin', (await count(teacher, 'academy_learners')) <= adminCounts.academy_learners);
  check('teacher cannot add a student', refused(await teacher.from('academy_learners').insert({ display_name: 'Should Be Refused' }).select('id')));
  check('teacher cannot create a course', refused(await teacher.from('academy_courses').insert({ title: 'Should Be Refused' }).select('id')));
  check('teacher cannot make themself admin', refused(await teacher.from('academy_staff').update({ role: 'admin' }).neq('role', 'admin').select('id')));
  check('teacher cannot approve payments', refused(await teacher.from('academy_fee_periods').update({ approved_status: 'paid' }).neq('approved_status', 'paid').select('id')));
  const tf = await teacher.rpc('academy_teacher_fee_periods');
  check('teacher can open their parent-payment list', !tf.error, tf.error?.message);
  const ff = await teacher.rpc('academy_family_fee', { p_guardian: '00000000-0000-0000-0000-000000000000' });
  check('teacher cannot compute family fees', Boolean(ff.error));
}

const finance = await signIn('FINANCE');
if (finance) {
  check('finance can read payment periods', (await count(finance, 'academy_fee_periods')) >= 0);
  check('finance cannot read the audit trail', (await count(finance, 'academy_audit_events')) <= 0);
  check('finance cannot add a student', refused(await finance.from('academy_learners').insert({ display_name: 'Should Be Refused' }).select('id')));
  const periods = await finance.from('academy_fee_periods').select('id,checked_status').eq('checked_status', 'paid').limit(1);
  if (periods.data?.length) check('finance cannot approve payments', refused(await finance.from('academy_fee_periods').update({ approved_status: 'paid' }).eq('id', periods.data[0].id).select('id')));
}

for (const c of [admin, teacher, finance]) if (c) await c.auth.signOut();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
