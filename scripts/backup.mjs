// Weekly backup of the Academy data, made by an ADMIN account (free; no secret keys needed).
// Saves every Academy table the admin can read into one file: backups/academy-backup-YYYY-MM-DD.json
// The file contains families' names and phone numbers: keep it on a school computer or school drive, never on a personal phone.
// Logins (emails and passwords) are kept by Supabase itself and are NOT in this file.
//
// Windows (cmd), in the project folder:
//   set ADMIN_EMAIL=you@example.com&& set ADMIN_PASSWORD=...
//   node scripts/backup.mjs
// Then close the window so the password is not left in it.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { collectPages } from '../src/live/paging.mjs';

const TABLES = [
  ['academy_staff', 'id'], ['academy_learners', 'id'], ['academy_guardians', 'id'], ['academy_guardian_links', 'learner_id,guardian_id'],
  ['academy_courses', 'id'], ['academy_classes', 'id'], ['academy_enrollments', 'class_id,learner_id'], ['academy_sessions', 'id'],
  ['academy_attendance', 'session_id,learner_id'], ['academy_assignments', 'id'], ['academy_submissions', 'id'],
  ['academy_fee_periods', 'id'], ['academy_reminder_events', 'id'], ['academy_audit_events', 'id']];

const env = Object.fromEntries(readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)
  .map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2]]));
const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = process.env;
if (!email || !password) { console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD first (see the top of this file).'); process.exit(2); }

const client = createClient(env.VITE_ACADEMY_SUPABASE_URL, env.VITE_ACADEMY_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const { data: auth, error: signInError } = await client.auth.signInWithPassword({ email, password });
if (signInError) { console.error('Sign-in failed: ' + signInError.message); process.exit(1); }
const staff = await client.from('academy_staff').select('role').eq('auth_user_id', auth.user.id).maybeSingle();
if (staff.data?.role !== 'admin') { console.error('This account is not an admin; a backup needs an admin account.'); process.exit(1); }

const backup = { made_at: new Date().toISOString(), project: env.VITE_ACADEMY_SUPABASE_URL, tables: {} };
let failed = 0;
for (const [table, order] of TABLES) {
  const { rows, error } = await collectPages((from, to) => {
    let q = client.from(table).select('*');
    for (const col of order.split(',')) q = q.order(col);
    return q.range(from, to);
  });
  if (error) { failed++; console.error(`FAILED ${table}: ${error.message}`); continue; }
  backup.tables[table] = rows;
  console.log(`${table}: ${rows.length} rows`);
}
await client.auth.signOut();
mkdirSync(new URL('../backups/', import.meta.url), { recursive: true });
const file = new URL(`../backups/academy-backup-${backup.made_at.slice(0, 10)}.json`, import.meta.url);
writeFileSync(file, JSON.stringify(backup, null, 1));
console.log(`\nSaved ${file.pathname}${failed ? ` — ${failed} table(s) FAILED, see above` : ''}`);
process.exit(failed ? 1 : 0);
