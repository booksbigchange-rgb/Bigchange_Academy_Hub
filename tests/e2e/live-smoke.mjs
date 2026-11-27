// Browser smoke test of the LIVE screens against a fake, in-memory Supabase (no real project is contacted).
// It checks that each role's screens render, the main buttons perform real calls, and nothing overflows on a phone.
// Database rules are tested separately in tests/sql/run_rls_tests.sh; this test only exercises the UI wiring.
//
// Usage: npm run test:e2e   (starts the app, runs this file with the accessibility scan, stops the app). By hand:
//   VITE_ACADEMY_SUPABASE_URL=https://smoketest.supabase.co VITE_ACADEMY_SUPABASE_PUBLISHABLE_KEY=sb_publishable_smoketest npx vite --port 5199 &
//   node tests/e2e/live-smoke.mjs [http://127.0.0.1:5199] [chromium executable path]
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://127.0.0.1:5199';
const EXEC = process.argv[3];
const API = 'https://smoketest.supabase.co';
const uid = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
let seq = 100;

function freshDb() {
  return {
    academy_staff: [
      { id: uid(1), auth_user_id: uid(901), role: 'admin', display_name: 'Admin Test', active: true },
      { id: uid(2), auth_user_id: uid(902), role: 'teacher', display_name: 'Teacher Test', active: true },
      { id: uid(3), auth_user_id: uid(903), role: 'finance', display_name: 'Finance Test', active: true }],
    // Confirmed logins that are not students or parents (what academy_staff_directory reads from auth.users).
    auth_users: [{ id: uid(901), email: 'admin@example.com' }, { id: uid(902), email: 'teacher@example.com' },
      { id: uid(903), email: 'finance@example.com' }, { id: uid(906), email: 'new.teacher@example.com' }],
    academy_learners: [], academy_guardians: [{ id: uid(40), auth_user_id: uid(904), display_name: 'Parent Test', email: 'p@example.com', phone_e164: '+251911000000', email_opt_in: true, whatsapp_opt_in: false }],
    academy_payment_methods: [{ code: 'israel', label: 'Israel', active: true, sort_order: 10 }, { code: 'ria_tsegay', label: 'Ria – Tsegay', active: true, sort_order: 30 },
      { code: 'habesha_shop', label: 'Habesha shop', active: true, sort_order: 60 }, { code: 'cash', label: 'Cash (old)', active: false, sort_order: 200 }],
    academy_learners_seed: [], academy_courses: [], academy_classes: [], academy_enrollments: [], academy_sessions: [],
    academy_attendance: [], academy_guardian_links: [], academy_fee_period_status: []
  };
}
const USERS = { admin: uid(901), teacher: uid(902), finance: uid(903), guardian: uid(904), learner: uid(905) };

function filterRows(rows, params) {
  return rows.filter(r => [...params].every(([k, v]) => {
    if (['select', 'order', 'limit', 'on_conflict', 'columns'].includes(k)) return true;
    if (v.startsWith('eq.')) return String(r[k]) === v.slice(3);
    return true;
  }));
}

async function install(page, db, role) {
  const user = { id: USERS[role], aud: 'authenticated', role: 'authenticated', email: role + '@example.com', email_confirmed_at: new Date().toISOString() };
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const token = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' }) + '.sig';
  const calls = [];
  await page.route(API + '/**', async route => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname; const method = req.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    calls.push(method + ' ' + path);
    if (path === '/auth/v1/token') return json({ access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user });
    if (path === '/auth/v1/user') return json(user);
    if (path === '/auth/v1/logout') return route.fulfill({ status: 204 });
    if (path.startsWith('/rest/v1/rpc/')) {
      const fn = path.slice('/rest/v1/rpc/'.length); const a = req.postDataJSON() || {};
      if (fn === 'academy_add_guardian') {
        const g = { id: uid(seq++), display_name: a.p_name, email: a.p_email, phone_e164: a.p_phone, email_opt_in: a.p_email_opt, whatsapp_opt_in: a.p_whatsapp_opt };
        db.academy_guardians.push(g); db.academy_guardian_links.push({ learner_id: a.p_learner, guardian_id: g.id, verified_by_staff_id: role === 'admin' ? uid(1) : null });
        return json(g.id);
      }
      if (fn === 'academy_guardians_for_learner') return json(db.academy_guardian_links.filter(l => l.learner_id === a.p_learner).map(l => {
        const g = db.academy_guardians.find(x => x.id === l.guardian_id); return { guardian_id: g.id, display_name: g.display_name, email: g.email, phone_e164: g.phone_e164, email_opt_in: g.email_opt_in, whatsapp_opt_in: g.whatsapp_opt_in, verified: l.verified_by_staff_id !== null };
      }));
      if (fn === 'academy_family_fee') return json([{ course_count: 1, amount_due: 150 }]);
      if (fn === 'academy_child_fee') return json([{ guardian_id: null, child_courses: 1, family_courses: 1, amount_due: 150 }]);
      if (fn === 'academy_create_child_period') {
        const link = db.academy_guardian_links.find(l => l.learner_id === a.p_learner && l.verified_by_staff_id);
        const end = new Date(a.p_start); end.setMonth(end.getMonth() + 3);
        db.academy_fee_period_status.push({ id: uid(seq++), guardian_id: link.guardian_id, learner_id: a.p_learner, period_start: a.p_start, period_end: end.toISOString().slice(0, 10), course_count: 1, amount_due: 150, currency_code: 'USD',
          reported_status: 'unpaid', paid_on: null, paid_method: null, paid_note: null, checked_status: 'unpaid', approved_status: 'unpaid', status: 'unpaid', stage: 'none' });
        return json(uid(seq));
      }
      if (fn === 'academy_set_class_level') { Object.assign(db.academy_classes.find(x => x.id === a.p_class), { title: a.p_title, level_start: a.p_start, level_end: a.p_end }); return route.fulfill({ status: 204 }); }
      if (fn === 'academy_set_period_amount') { db.academy_fee_period_status.find(x => x.id === a.p_period).amount_due = a.p_amount; return route.fulfill({ status: 204 }); }
      if (fn === 'academy_create_fee_period') {
        const end = new Date(a.p_start); end.setMonth(end.getMonth() + 3);
        db.academy_fee_period_status.push({ id: uid(seq++), guardian_id: a.p_guardian, period_start: a.p_start, period_end: end.toISOString().slice(0, 10), course_count: 1, amount_due: 150, currency_code: 'USD',
          reported_status: 'unpaid', paid_on: null, paid_method: null, paid_note: null, checked_status: 'unpaid', approved_status: 'unpaid', status: 'unpaid', stage: 'none' });
        return json(uid(seq));
      }
      if (fn === 'academy_report_payment') {
        const p = db.academy_fee_period_status.find(x => x.id === a.p_period);
        Object.assign(p, { reported_status: a.p_status, paid_on: a.p_paid_on, paid_method: a.p_method, paid_note: a.p_note, paid_amount: a.p_amount ?? null, stage: a.p_status === 'unpaid' ? 'none' : 'reported', checked_status: 'unpaid', approved_status: 'unpaid', status: 'unpaid' });
        return route.fulfill({ status: 204 });
      }
      if (fn === 'academy_teacher_fee_periods') return json(db.academy_fee_period_status.map(p => { const g = db.academy_guardians.find(x => x.id === p.guardian_id) ?? {}; return { period_id: p.id, guardian_id: p.guardian_id, guardian_name: g.display_name ?? 'Parent Test', guardian_phone: g.phone_e164 ?? null,
        period_start: p.period_start, period_end: p.period_end, amount_due: p.amount_due, status: p.status, stage: p.stage, reported_status: p.reported_status, paid_on: p.paid_on, paid_method: p.paid_method, paid_note: p.paid_note, paid_amount: p.paid_amount ?? null, students: ['Kid Test'], courses: ['Course Test'],
        whatsapp_opt_in: Boolean(g.whatsapp_opt_in), last_reminded_at: (db.academy_reminder_events ?? []).filter(r => r.period_id === p.id).map(r => r.sent_at).sort().pop() ?? null }; }));
      if (fn === 'academy_set_guardian_consent') { const g = db.academy_guardians.find(x => x.id === a.p_guardian); g.email_opt_in = a.p_email_opt ?? g.email_opt_in; g.whatsapp_opt_in = a.p_whatsapp_opt ?? g.whatsapp_opt_in; return route.fulfill({ status: 204 }); }
      if (fn === 'academy_log_reminder') {
        const p = db.academy_fee_period_status.find(x => x.id === a.p_period); const g = db.academy_guardians.find(x => x.id === p.guardian_id);
        if (a.p_channel === 'whatsapp' && !g.whatsapp_opt_in) return json({ message: 'This parent has not agreed to WhatsApp messages' }, 400);
        (db.academy_reminder_events ??= []).push({ id: uid(seq++), period_id: p.id, sent_at: new Date().toISOString() }); return json(new Date().toISOString());
      }
      if (db.before0010 && fn.startsWith('academy_s') && fn.includes('staff')) return json({ code: 'PGRST202', message: 'Could not find the function public.' + fn }, 404);
      if (fn === 'academy_staff_directory') return json(db.auth_users.map(u => { const st = db.academy_staff.find(x => x.auth_user_id === u.id);
        return { user_id: u.id, email: u.email, staff_id: st?.id ?? null, display_name: st?.display_name ?? null, role: st?.role ?? null, active: Boolean(st?.active),
          class_count: st ? db.academy_classes.filter(c => c.teacher_staff_id === st.id).length : 0, last_sign_in_at: null }; }));
      if (fn === 'academy_set_staff_role') {
        if (a.p_user === user.id) return json({ message: 'You cannot change your own role. Ask another administrator.' }, 400);
        const st = db.academy_staff.find(x => x.auth_user_id === a.p_user);
        if (st) Object.assign(st, { role: a.p_role, display_name: a.p_name, active: true });
        else db.academy_staff.push({ id: uid(seq++), auth_user_id: a.p_user, role: a.p_role, display_name: a.p_name, active: true });
        return json(db.academy_staff.find(x => x.auth_user_id === a.p_user).id);
      }
      if (fn === 'academy_set_staff_active') { db.academy_staff.find(x => x.id === a.p_staff).active = a.p_active; return route.fulfill({ status: 204 }); }
      return json({ message: 'unknown rpc ' + fn }, 404);
    }
    if (path.startsWith('/rest/v1/')) {
      let table = path.slice('/rest/v1/'.length);
      const store = table === 'academy_fee_periods' ? 'academy_fee_period_status' : table;
      const rows = db[store] ?? (db[store] = []);
      const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
      if (method === 'GET') {
        if (db.before0010 && table === 'academy_staff' && (url.searchParams.get('select') || '').includes('active'))
          return json({ code: '42703', message: 'column academy_staff.active does not exist' }, 400);
        let out = filterRows(rows, url.searchParams);
        if (table === 'academy_guardians' && role === 'guardian') out = out.filter(g => g.auth_user_id === user.id);
        if (table === 'academy_staff' || table === 'academy_learners' || table === 'academy_guardians') {
          if (url.searchParams.get('auth_user_id')) out = out.filter(r => r.auth_user_id === url.searchParams.get('auth_user_id').slice(3));
        }
        if (single) return out.length ? json(out[0]) : json({ code: 'PGRST116', message: 'no rows' }, 406);
        return json(out);
      }
      if (method === 'POST') {
        if (db.delayMs && table === 'academy_learners') await new Promise(r => setTimeout(r, db.delayMs));
        const body = req.postDataJSON(); const list = Array.isArray(body) ? body : [body];
        const created = list.map(r => {
          if (table === 'academy_attendance') {
            const i = rows.findIndex(x => x.session_id === r.session_id && x.learner_id === r.learner_id);
            if (i >= 0) { rows[i] = { ...rows[i], ...r }; return rows[i]; }
          }
          if (table === 'academy_enrollments' && rows.some(x => x.class_id === r.class_id && x.learner_id === r.learner_id)) return null;
          const row = { id: uid(seq++), active: true, grade_level: null, note: null, description: null, ...r }; rows.push(row); return row;
        });
        if (created.includes(null)) return json({ code: '23505', message: 'duplicate' }, 409);
        return single ? json(created[0], 201) : json(created, 201);
      }
      if (method === 'PATCH') {
        const patch = req.postDataJSON(); const hit = filterRows(rows, url.searchParams);
        for (const r of hit) {
          Object.assign(r, patch);
          if (store === 'academy_fee_period_status') {
            if ('checked_status' in patch) r.stage = 'checked';
            if ('approved_status' in patch) { r.stage = 'approved'; r.status = patch.approved_status; }
          }
          if ('verified_by_staff_id' in patch) r.verified_by_staff_id = patch.verified_by_staff_id;
        }
        return json(hit);
      }
      if (method === 'DELETE') {
        const hit = filterRows(rows, url.searchParams); db[store] = rows.filter(r => !hit.includes(r)); return json(hit);
      }
    }
    return json({ message: 'not mocked: ' + method + ' ' + path }, 404);
  });
  return calls;
}

const results = []; let failed = 0;
function check(name, ok, detail = '') { results.push((ok ? 'PASS ' : 'FAIL ') + name + (ok || !detail ? '' : ' — ' + detail)); if (!ok) failed++; }

async function session(browser, db, role, width, fn) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await install(page, db, role);
  await page.goto(BASE);
  await page.getByLabel('Email address').fill(role + '@example.com');
  await page.getByLabel('Password').fill('correct-horse-battery');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByText('Live database').waitFor({ timeout: 10000 });
  await page.getByText('Loading…').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
  try { await fn(page); } catch (e) { check(role + ': flow completed', false, e.message.split('\n')[0]); await page.screenshot({ path: (process.env.SHOTS || '.') + '/fail-' + role + '.png', fullPage: true }).catch(() => {}); }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`${role} @${width}px: no horizontal page scroll`, overflow <= 1, overflow + 'px overflow');
  check(`${role}: no runtime errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
  await context.close();
}
/** Wait (up to 5 s) for something to appear; returns whether it did. */
const seen = (locator, ms = 5000) => locator.first().waitFor({ state: 'visible', timeout: ms }).then(() => true, () => false);
const nav = (page, name) => page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name, exact: true }).click();

const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
const db = freshDb();

// Google sign-in: the button exists; while Google is not switched on in Supabase it explains instead of opening an error page.
{
  const p = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  await p.route(API + '/**', r => r.request().url().includes('/auth/v1/settings')
    ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ external: { email: true, google: false }, disable_signup: true }) })
    : r.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
  await p.goto(BASE);
  await p.getByRole('button', { name: 'Sign in with Google' }).click();
  check('Google sign-in explains when it is not switched on yet', await seen(p.getByText(/Google sign-in is not switched on yet/)));
  await p.goto('about:blank');
  await p.goto(BASE + '/?error=access_denied&error_description=Signups+not+allowed+for+this+instance');
  check('a Google account that was not added gets a clear message', await seen(p.getByText(/has not been added to the Academy/)));
  await p.goto('about:blank');
  await p.goto(BASE + '/?error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code%3A+4%2F0Ab');
  check('a Google set-up problem says what to fix (Client ID and Secret)', await seen(p.getByText(/copy the Client ID and Client Secret again/)));
  await p.context().close();
}

await session(browser, db, 'admin', 1366, async page => {
  check('admin lands on Overview', await seen(page.getByRole('heading', { name: 'Welcome back' })));
  await nav(page, 'Courses');
  await page.getByLabel('Course title').fill('Course Test');
  await page.getByRole('button', { name: '+ Add course' }).click();
  await page.getByRole('cell', { name: 'Course Test' }).waitFor();
  check('admin adds a course', true);
  await nav(page, 'Students');
  await page.getByLabel('Parent name').fill('Parent Test');
  await page.getByLabel('Name', { exact: true }).fill('K');
  await page.getByRole('button', { name: '+ Add student' }).click();
  check('student name too short is rejected', await seen(page.getByText(/2 to 80/)));
  await page.getByLabel('Name', { exact: true }).fill('Kid Test');
  await page.getByRole('button', { name: '+ Add student' }).click();
  check('student without a parent phone or email is refused', await seen(page.getByText('Enter a phone number or an email address')));
  check('nothing was saved when the parent was invalid', (await page.getByRole('cell', { name: 'Kid Test' }).count()) === 0);
  await page.getByLabel(/^Parent phone/).fill('0911 000 000');
  await page.getByRole('button', { name: '+ Add student' }).click();
  await page.getByRole('cell', { name: 'Kid Test' }).waitFor();
  check('admin adds a student and parent in one step', await seen(page.getByText('Student and parent saved.')));
  await page.getByLabel('Search students').fill('zzz');
  check('search filters students', await seen(page.getByText('No students match your search.')));
  await nav(page, 'Classes');
  await page.getByLabel('Class title').fill('Class Test');
  await page.getByRole('combobox', { name: /^Course/ }).selectOption({ label: 'Course Test' });
  await page.getByRole('button', { name: '+ Create class' }).click();
  await page.getByRole('cell', { name: 'Class Test' }).waitFor();
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.getByLabel('Enroll a student').selectOption({ label: 'Kid Test' });
  await page.getByRole('button', { name: '+ Enroll' }).click();
  await page.getByRole('listitem').filter({ hasText: 'Kid Test' }).waitFor();
  check('admin creates a class and enrolls the student', true);
  await page.getByRole('button', { name: '+ Enroll' }).click();
  check('enrolling twice shows an error', await seen(page.getByText('Already enrolled in this class')));
  await nav(page, 'Attendance');
  await page.getByRole('combobox', { name: /^Class/ }).selectOption({ label: 'Class Test' });
  await page.getByLabel('Date').fill('2026-11-02');
  await page.getByRole('button', { name: '+ Add lesson' }).click();
  await page.getByLabel('Lesson').waitFor();
  await page.getByLabel('Lesson').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Save attendance' }).click();
  check('saving with an unmarked student is refused', await seen(page.getByText(/Mark every student/)));
  await page.getByLabel('Attendance for Kid Test').selectOption('present');
  await page.getByRole('button', { name: 'Save attendance' }).click();
  await page.getByText('Attendance saved.').waitFor();
  check('admin records attendance and sees the summary', await seen(page.getByText(/Attendance rate/)));
  {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download attendance (CSV)' }).click()]);
    const text = await (await import('node:fs')).promises.readFile(await dl.path(), 'utf8');
    check('admin downloads the class attendance as CSV', /^bigchange-attendance-class-test-\d{4}-\d{2}-\d{2}\.csv$/.test(dl.suggestedFilename())
      && text.includes('"Date","Time","Class","Student","Status"') && text.includes('"2026-11-02","16:00","Class Test","Kid Test","Present"'), dl.suggestedFilename());
    await page.getByLabel('From (optional)').fill('2026-12-01');
    await page.getByRole('button', { name: 'Download attendance (CSV)' }).click();
    check('an empty date range downloads nothing and says so', await seen(page.getByText('No attendance recorded for that choice. Nothing was downloaded.')));
    await page.getByLabel('From (optional)').fill('');
  }
  await page.getByLabel('Date').fill('2026-11-02');
  await page.getByRole('button', { name: '+ Add lesson' }).click();
  check('duplicate lesson on the same day is refused', await seen(page.getByText(/already has a lesson/)));
  await nav(page, 'Guardians');
  await page.getByRole('combobox', { name: /^Student/ }).selectOption({ label: 'Kid Test' });
  check('the parent from the student form is linked, verified, phone normalised',
    await seen(page.getByRole('cell', { name: '+251911000000' })) && await seen(page.getByText('Verified', { exact: true })));
  await nav(page, 'Fees');
  await page.getByRole('combobox', { name: /^Child/ }).selectOption({ index: 1 });
  check('a newly enrolled child is listed as needing their first 3 months', await seen(page.getByRole('region', { name: 'Children who need the next 3 months' }).getByRole('row', { name: /Kid Test.*Not started/ })));
  await page.getByRole('button', { name: 'Show fee' }).click();
  check('fee preview shows the child and USD 150', await seen(page.getByText(/Kid Test: 1 course.*USD 150/).first()));
  await page.getByRole('button', { name: 'Start 3 months' }).click();
  await page.getByRole('button', { name: 'Report', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Report', exact: true }).click();
  check('switched-off methods are not offered', (await page.getByLabel('How they paid').locator('option', { hasText: 'Cash (old)' }).count()) === 0);
  check('Tigrinya help is shown on the report form', await seen(page.locator('.ti-help[lang="ti"]').first()));
  await page.getByLabel('How they paid').selectOption('ria_tsegay');
  await page.getByLabel('Amount paid in USD (optional)').fill('150');
  await page.getByLabel('Note or reference (optional, max 120)').fill('Receipt 1');
  await page.getByRole('button', { name: 'Save report' }).click();
  await page.getByRole('button', { name: /^Check/ }).waitFor();
  check('payment report moves to "awaiting finance check"', await seen(page.getByText('Reported, awaiting finance check')));
  check('the report shows the method name and the amount', await seen(page.getByText(/Ria – Tsegay · USD 150/).first()));
  await page.getByRole('button', { name: /^Check/ }).click();
  await page.getByRole('button', { name: /^Approve/ }).waitFor();
  await page.getByRole('button', { name: /^Approve/ }).click();
  await page.getByText('Approved', { exact: true }).waitFor();
  check('admin approves; status becomes Paid', await seen(page.locator('.tag.green', { hasText: 'Paid' }).first()));
  check('the period belongs to the child', await seen(page.getByRole('cell', { name: /^Kid Test: / })));
  await page.getByRole('button', { name: 'Change amount' }).click();
  await page.getByLabel('New amount (USD)').fill('120');
  await page.getByRole('button', { name: 'Save amount' }).click();
  check('an amount without a reason is refused by the form', (await page.getByRole('cell', { name: /USD 120/ }).count()) === 0);
  await page.getByLabel('Reason').fill('Second child joined');
  await page.getByRole('button', { name: 'Save amount' }).click();
  check('admin changes the amount with a reason', await seen(page.getByRole('cell', { name: /USD 120/ })));
  await page.getByLabel('New payment method').fill('Telebirr');
  await page.getByRole('button', { name: '+ Add method' }).click();
  check('admin adds a payment method', await seen(page.getByLabel('Payment methods').getByRole('cell', { name: 'Telebirr' })));
  // A lesson today, so the attendance charts have data whatever date the test runs on.
  {
    const kid = db.academy_learners.find(l => l.display_name === 'Kid Test');
    const when = new Date(); when.setHours(10, 0, 0, 0);
    const sid = uid(seq++);
    db.academy_sessions.push({ id: sid, class_id: db.academy_classes[0].id, starts_at: when.toISOString() });
    db.academy_attendance.push({ session_id: sid, learner_id: kid.id, status: 'present', recorded_by_staff_id: uid(1) });
    await page.reload();
    await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  }
  check('overview cards render', (await page.locator('.metric').count()) === 4);
  check('overview: payments donut shows the paid period', await seen(page.getByRole('img', { name: /^Donut chart of current payment periods: 1 paid/ })));
  check('overview: students-per-course bars', await seen(page.getByRole('region', { name: 'Students per course' }).getByText('Course Test')));
  check('overview: attendance line chart', await seen(page.getByRole('img', { name: /^Line chart of attendance per week/ })));
  check('overview: heat calendar shows today at 100%', await seen(page.getByRole('table', { name: 'Attendance per day, last 4 weeks' }).getByRole('cell', { name: '100% present' })));
  check('overview: attendance card shows the 4-week rate', await seen(page.locator('.metric', { hasText: 'Attendance (4 weeks)' }).getByText('100%')));
  if (process.env.SCREENSHOTS) await page.screenshot({ path: `${process.env.SCREENSHOTS}/admin-overview-new.png`, fullPage: true });
  await nav(page, 'Courses');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('New course title').fill('English Level 2');
  await page.getByRole('button', { name: 'Save course' }).click();
  check('admin renames a course', await seen(page.getByRole('cell', { name: 'English Level 2' })));
  await nav(page, 'Classes');
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.getByLabel('Rename class').fill('Class Renamed');
  await page.getByRole('button', { name: 'Save name' }).click();
  check('admin renames a class', await seen(page.getByRole('cell', { name: 'Class Renamed' })));
  // Level dates: a level that started almost 3 months ago ends in about 5 days.
  const iso = d => d.toISOString().slice(0, 10);
  const startDay = new Date(); startDay.setMonth(startDay.getMonth() - 3); startDay.setDate(startDay.getDate() + 5);
  await page.getByRole('button', { name: 'View', exact: true }).click().catch(() => {});
  const levelForm = page.getByRole('form', { name: 'Level dates' });
  await levelForm.getByLabel('Class name').fill('English – Level 2');
  await levelForm.getByLabel('Level starts').fill(iso(startDay));
  await levelForm.getByRole('button', { name: 'Save level dates' }).click();
  check('level dates saved and shown with "Ends in … days"', await seen(page.getByText(/^Ends in \d+ days$/)));
  await nav(page, 'Overview');
  check('overview reminds that a level ends soon', await seen(page.getByRole('heading', { name: 'Levels ending soon (1)' })));
  await page.getByRole('button', { name: 'Write notice to parents' }).click();
  check('notice opens with the class and its end date filled in', await seen(page.getByText(/^Dear parents, English – Level 2 finishes on .* \(English – Level 3\) starts on/)));
  await nav(page, 'Classes');
  await page.getByRole('button', { name: 'View', exact: true }).click().catch(() => {});
  await page.getByRole('button', { name: 'Move to next level' }).click();
  check('next level name suggested', (await page.getByRole('form', { name: 'Level dates' }).getByLabel('Class name').inputValue()) === 'English – Level 3');
  await page.getByRole('button', { name: 'Move class to next level' }).click();
  check('class moved to the next level; students stay', await seen(page.getByRole('cell', { name: 'English – Level 3' })) && await seen(page.getByText('Class moved to the next level. The same students stay enrolled.')));
  await page.getByRole('button', { name: 'Hide', exact: true }).click().catch(() => {});
  await nav(page, 'Students');
  await page.getByRole('row', { name: /Kid Test/ }).getByRole('button', { name: 'Attendance' }).click();
  check('student attendance history shows the saved mark', await seen(page.getByRole('cell', { name: 'Present' })) && await seen(page.getByText(/Attendance rate 100%/)));
  // Import students from a spreadsheet (CSV): preview, then import; existing students are skipped.
  await nav(page, 'Students');
  await page.getByRole('button', { name: 'Import from a spreadsheet (CSV)' }).click();
  const csv = ['Student name,Grade,Parent name,Parent phone,Parent email,WhatsApp OK,Email OK,Class',
    'Import Kid One,5,Import Parent,0911 222 001,,yes,,english - level 3',
    'Kid Test,,Someone,0911222002,,,,',
    'X,,Parent,0911222003,,,,',
    'Import Kid Two,,Import Parent Two,,two@example.com,,yes,'].join('\n');
  await page.getByLabel('Spreadsheet file (.csv)').setInputFiles({ name: 'students.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  check('import preview counts ready, skipped and problem rows', await seen(page.getByText(/4 rows · 2 ready · 1 skipped · 1 with problems/)));
  const preview = page.getByRole('region', { name: 'Import preview' });
  check('preview explains the skipped and problem rows', await seen(preview.getByText('A student with this name is already in the app'))
    && await seen(preview.getByText(/2 to 80 characters/)));
  check('preview matches the class name and normalises the phone', await seen(preview.getByRole('cell', { name: 'English – Level 3' }))
    && await seen(preview.getByRole('cell', { name: '+251911222001' })));
  if (process.env.SCREENSHOTS) await preview.screenshot({ path: `${process.env.SCREENSHOTS}/admin-import-preview.png` });
  if (process.env.AXE_PATH) {
    await page.addScriptTag({ path: process.env.AXE_PATH });
    const v = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => x.id));
    check('axe import preview: no serious/critical issues', v.length === 0, v.join(' | '));
  }
  db.delayMs = 400;
  await page.getByRole('button', { name: 'Import 2 students' }).click();
  check('"Close import" cannot be pressed while the import is running', await page.getByRole('button', { name: 'Close import' }).isDisabled());
  await page.getByText('Finished: 2 of 2 students added.').waitFor();
  db.delayMs = 0;
  check('"Close import" works again when the import has finished', await page.getByRole('button', { name: 'Close import' }).isEnabled());
  const kidOne = db.academy_learners.find(l => l.display_name === 'Import Kid One');
  check('imported students appear in the list', await seen(page.getByRole('cell', { name: 'Import Kid One' })) && await seen(page.getByRole('cell', { name: 'Import Kid Two' })));
  check('imported student has grade, parent with WhatsApp consent, and class',
    kidOne?.grade_level === 'Grade 5'
    && db.academy_guardians.some(g => g.phone_e164 === '+251911222001' && g.whatsapp_opt_in === true && g.email_opt_in === false)
    && db.academy_enrollments.some(e => e.learner_id === kidOne?.id));
  check('the skipped and problem rows were not imported', db.academy_learners.filter(l => l.display_name === 'Kid Test').length === 1 && !db.academy_learners.some(l => l.display_name === 'X'));
  await page.getByLabel('Spreadsheet file (.csv)').setInputFiles({ name: 'students.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  check('choosing the same file again shows the imported rows as skipped', await seen(page.getByText(/4 rows · 0 ready · 3 skipped · 1 with problems/)));
  await page.getByRole('button', { name: 'Close import' }).click();
  // Staff screen (migration 0010): give a waiting login a role, then switch access off.
  await nav(page, 'Staff');
  const waitingTable = page.getByRole('region', { name: 'Logins waiting for a role' });
  check('a new login waits for a role', await seen(waitingTable.getByRole('cell', { name: 'new.teacher@example.com' })));
  const staffTable = page.getByRole('region', { name: 'Staff members' });
  check('the admin cannot change their own row', await seen(staffTable.getByRole('row', { name: /admin@example.com/ }).getByText('You'))
    && (await staffTable.getByRole('row', { name: /admin@example.com/ }).getByRole('button', { name: /Change role|Switch/ }).count()) === 0);
  await waitingTable.getByRole('button', { name: 'Give a role' }).click();
  const roleForm = page.getByRole('form', { name: 'Staff role' });
  await roleForm.getByLabel('Name shown in the app').fill('New Teacher');
  await roleForm.getByLabel('Role').selectOption('teacher');
  await roleForm.getByRole('button', { name: 'Save role' }).click();
  await page.getByText('Role saved: New Teacher · Teacher.').waitFor();
  check('admin gives the new login the teacher role', await seen(staffTable.getByRole('cell', { name: 'New Teacher' }))
    && (await waitingTable.count()) === 0);
  await nav(page, 'Classes');
  check('the new teacher can be chosen for a class', (await page.getByLabel(/^Teacher for /).first().locator('option', { hasText: 'New Teacher' }).count()) === 1);
  await nav(page, 'Staff');
  await staffTable.getByRole('row', { name: /New Teacher/ }).getByRole('button', { name: 'Switch off' }).click();
  await page.getByText(/Access switched off for New Teacher/).waitFor();
  check('admin switches the new teacher off', await seen(staffTable.getByRole('row', { name: /New Teacher/ }).locator('.tag.red', { hasText: 'Off' })));
  await nav(page, 'Classes');
  check('a switched-off teacher is no longer offered for classes', (await page.getByLabel(/^Teacher for /).first().locator('option', { hasText: 'New Teacher' }).count()) === 0);
  await nav(page, 'Staff');
  await staffTable.getByRole('row', { name: /New Teacher/ }).getByRole('button', { name: 'Switch on' }).click();
  await page.getByText(/Access switched on for New Teacher/).waitFor();
  check('admin switches the teacher on again', await seen(staffTable.getByRole('row', { name: /New Teacher/ }).locator('.tag.green', { hasText: 'On' })));
  // Teacher profile: give Teacher Test the class, then open the profile from the Staff screen.
  await nav(page, 'Classes');
  await page.getByLabel(/^Teacher for /).first().selectOption({ label: 'Teacher Test' });
  await page.getByText('Teacher updated.').waitFor();
  await nav(page, 'Staff');
  await page.getByRole('button', { name: 'Profile of Teacher Test' }).click();
  const profile = page.getByRole('region', { name: 'Profile of Teacher Test' });
  check('teacher profile opens with name, role and email', await seen(profile.getByRole('heading', { name: 'Teacher Test' })) && await seen(profile.getByText('teacher@example.com')));
  check('teacher profile lists their class and its students', await seen(profile.getByRole('region', { name: 'Classes of this teacher' }).getByRole('cell', { name: 'English – Level 3' })));
  check('teacher profile shows lessons per month and incomplete attendance', await seen(profile.getByRole('img', { name: /^Bar chart of lessons per month/ }))
    && await seen(profile.getByText('1 of 2 marked')));
  check('teacher profile shows their attendance heat calendar', await seen(profile.getByRole('table', { name: 'Attendance per day, last 4 weeks' })));
  if (process.env.SCREENSHOTS) await profile.screenshot({ path: `${process.env.SCREENSHOTS}/admin-teacher-profile.png` });
  if (process.env.AXE_PATH) {
    await page.addScriptTag({ path: process.env.AXE_PATH });
    const v = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => x.id));
    check('axe teacher profile: no serious/critical issues', v.length === 0, v.join(' | '));
  }
  await profile.getByRole('button', { name: 'Close profile' }).click();
  check('profile closes', (await page.getByRole('region', { name: 'Profile of Teacher Test' }).count()) === 0);
  // Student profile (admin sees everything).
  await nav(page, 'Students');
  await page.getByRole('row', { name: /^Kid Test/ }).getByRole('button', { name: 'Profile', exact: true }).click();
  const sp = page.getByRole('region', { name: 'Profile of Kid Test' });
  check('student profile opens with name and grade', await seen(sp.getByRole('heading', { name: 'Kid Test' })));
  check('student profile shows the parent and phone', await seen(sp.getByRole('region', { name: 'Parents' }).getByText('+251911000000')));
  check('student profile shows the class with its teacher', await seen(sp.getByRole('region', { name: 'Classes and teachers' }).getByText(/Teacher Test/)));
  check('student profile shows the payment history with the current period paid', await seen(sp.getByRole('region', { name: 'Payment periods of this student' }).getByText('Current'))
    && await seen(sp.getByRole('region', { name: 'Payment periods of this student' }).locator('.tag.green', { hasText: 'Paid' })));
  check('student profile shows attendance calendar and recent lessons', await seen(sp.getByRole('table', { name: 'Attendance per day, last 4 weeks' }))
    && await seen(sp.getByRole('region', { name: 'Recent lessons of this student' }).getByRole('cell', { name: 'Present' })));
  if (process.env.SCREENSHOTS) await sp.screenshot({ path: `${process.env.SCREENSHOTS}/admin-student-profile.png` });
  if (process.env.AXE_PATH) {
    await page.addScriptTag({ path: process.env.AXE_PATH });
    const v = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => x.id));
    check('axe student profile: no serious/critical issues', v.length === 0, v.join(' | '));
  }
  await sp.getByRole('button', { name: 'Close profile' }).click();
  // Reports: lessons per teacher this month (the test added a lesson today, so this month has at least one).
  await nav(page, 'Reports');
  const rt = page.getByRole('region', { name: 'Lessons per teacher table' });
  check('reports: lessons per teacher lists the class teacher for this month', await seen(rt.getByRole('row', { name: /^Teacher Test/ })));
  check('reports: chart and totals render', await seen(page.getByRole('img', { name: /^Bar chart of lessons per teacher: Teacher Test/ })) && await seen(rt.getByRole('row', { name: /^Total/ })));
  {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download summary (CSV)' }).click()]);
    const text = await (await import('node:fs')).promises.readFile(await dl.path(), 'utf8');
    check('reports: summary downloads as CSV', /^bigchange-lessons-per-teacher-\d{4}-\d{2}\.csv$/.test(dl.suggestedFilename())
      && text.includes('"Month","Teacher","Classes","Lessons held"') && text.includes('"Teacher Test"'), dl.suggestedFilename());
    const [dl2] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download every lesson (CSV)' }).click()]);
    const text2 = await (await import('node:fs')).promises.readFile(await dl2.path(), 'utf8');
    check('reports: every lesson downloads as CSV', text2.includes('"Date","Time","Class","Teacher","Held","Marked","Enrolled"') && text2.includes('"English – Level 3"'));
  }
  if (process.env.SCREENSHOTS) await page.screenshot({ path: `${process.env.SCREENSHOTS}/admin-reports.png`, fullPage: true });
  await page.getByRole('button', { name: 'Previous month' }).click();
  await page.getByRole('button', { name: 'Previous month' }).click();
  await page.getByRole('button', { name: 'Previous month' }).click();
  check('reports: another month without lessons says so', await seen(page.getByText(/^No lessons in /)));
  // Activity log: a few audit rows as the database triggers would write them.
  {
    const kid = db.academy_learners.find(l => l.display_name === 'Kid Test');
    const base = { learner_id: kid.id, guardian_id: db.academy_guardians[0].id, reported_status: 'paid', checked_status: 'paid', paid_on: null, paid_method: null, paid_amount: null };
    const now = new Date(); const yesterday = new Date(Date.now() - 86400000);
    db.academy_audit_events = [
      { id: 3, actor_id: uid(901), action: 'UPDATE', entity_type: 'academy_fee_periods', entity_id: null, created_at: now.toISOString(), detail: { before: { ...base, approved_status: 'unpaid' }, after: { ...base, approved_status: 'paid' } } },
      { id: 2, actor_id: uid(901), action: 'UPDATE', entity_type: 'academy_staff', entity_id: uid(2), created_at: now.toISOString(), detail: { before: { id: uid(2), display_name: 'Teacher Test', role: 'teacher', active: true }, after: { id: uid(2), display_name: 'Teacher Test', role: 'teacher', active: false } } },
      { id: 1, actor_id: uid(902), action: 'INSERT', entity_type: 'academy_enrollments', entity_id: null, created_at: yesterday.toISOString(), detail: { class_id: db.academy_classes[0].id, learner_id: kid.id } },
    ];
  }
  await page.getByRole('button', { name: 'Activity log' }).click();
  check('activity log: payment approval in plain words, with who', await seen(page.locator('.activity-list li', { hasText: 'approved the payment of Kid Test as Paid' }).filter({ hasText: 'Admin Test' })));
  check('activity log: grouped by Today and Yesterday', await seen(page.getByRole('heading', { name: 'Today' })) && await seen(page.getByRole('heading', { name: 'Yesterday' }))
    && await seen(page.locator('.activity-list li', { hasText: /Teacher Test.*enrolled Kid Test in/ })));
  await page.getByLabel('Area').selectOption('Staff');
  check('activity log: filter by area', (await page.locator('.activity-list li').count()) === 1 && await seen(page.getByText(/switched Teacher Test's access off/)));
  await page.getByLabel('Area').selectOption('');
  await page.getByLabel('Who').selectOption('Teacher Test');
  check('activity log: filter by person', (await page.locator('.activity-list li').count()) === 1);
  await page.getByLabel('Who').selectOption('');
  {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download (CSV)' }).click()]);
    const text = await (await import('node:fs')).promises.readFile(await dl.path(), 'utf8');
    check('activity log downloads as CSV', text.includes('"Date","Time","Who","Area","What happened"') && text.includes('Approved the payment of Kid Test as Paid'));
  }
  if (process.env.SCREENSHOTS) await page.screenshot({ path: `${process.env.SCREENSHOTS}/admin-activity.png`, fullPage: true });
  if (process.env.AXE_PATH) {
    await page.addScriptTag({ path: process.env.AXE_PATH });
    const v = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => x.id));
    check('axe activity log: no serious/critical issues', v.length === 0, v.join(' | '));
  }
  // Monthly report (this month: the test added a lesson today).
  await page.getByRole('button', { name: 'Monthly report' }).click();
  const mr = page.getByRole('article', { name: /^Monthly report / });
  check('monthly report: title, payments and lessons per teacher', await seen(mr.getByRole('heading', { name: /^Monthly report · / }))
    && await seen(mr.getByRole('region', { name: 'Payments this month' }).getByRole('rowheader', { name: '3-month periods started' }))
    && await seen(mr.getByRole('region', { name: 'Lessons per teacher this month' }).getByRole('cell', { name: 'Teacher Test' })));
  check('monthly report: attendance per class and students per course', await seen(mr.getByRole('region', { name: 'Attendance per class' }).getByRole('cell', { name: 'English – Level 3' }))
    && await seen(mr.getByRole('region', { name: 'Students per course' })));
  check('monthly report has a print button', await seen(page.getByRole('button', { name: 'Print or save as PDF' })));
  await page.emulateMedia({ media: 'print' });
  const printView = await page.evaluate(() => ({
    menu: getComputedStyle(document.querySelector('nav[aria-label="Sections"]')).visibility,
    report: getComputedStyle(document.querySelector('.monthly-report h3')).visibility,
    buttons: getComputedStyle(document.querySelector('.report-month')).display }));
  check('printing shows only the report (no menu, no buttons)', printView.menu === 'hidden' && printView.report === 'visible' && printView.buttons === 'none', JSON.stringify(printView));
  if (process.env.SCREENSHOTS) await page.pdf({ path: `${process.env.SCREENSHOTS}/monthly-report.pdf`, format: 'A4', printBackground: true });
  await page.emulateMedia({ media: 'screen' });
  if (process.env.AXE_PATH) {
    await page.addScriptTag({ path: process.env.AXE_PATH });
    const v = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => x.id));
    check('axe monthly report: no serious/critical issues', v.length === 0, v.join(' | '));
  }
  // Backup download: one ZIP with a read-me and a CSV per table.
  await page.getByRole('button', { name: 'Backup download' }).click();
  {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download backup (ZIP)' }).click()]);
    const { readZip } = await import('../../src/live/zip.mjs');
    const files = readZip(new Uint8Array(await (await import('node:fs')).promises.readFile(await dl.path())));
    const names = files.map(f => f.name);
    check('backup downloads as one ZIP with a read-me and every table', /^bigchange-backup-\d{4}-\d{2}-\d{2}\.zip$/.test(dl.suggestedFilename())
      && names[0] === 'README.txt' && ['students.csv', 'parents.csv', 'attendance.csv', 'payment_periods.csv', 'staff.csv'].every(n => names.includes(n))
      && files.every(f => f.crcOk), names.join(','));
    check('backup contains the real rows', files.find(f => f.name === 'students.csv').text.includes('"Kid Test"') && files.find(f => f.name === 'parents.csv').text.includes("'+251911000000"));
    check('backup screen remembers the last download on this computer', await seen(page.getByText(/^Last downloaded on this computer: /)));
  }
  if (process.env.AXE_PATH) {
    await page.addScriptTag({ path: process.env.AXE_PATH });
    const v = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => x.id));
    check('axe backup download: no serious/critical issues', v.length === 0, v.join(' | '));
  }
});

// Before the owner runs migration 0010: the admin's app must still load; only the Staff screen explains what is missing.
await session(browser, { ...freshDb(), before0010: true }, 'admin', 1366, async page => {
  check('before migration 0010 the admin app still loads', await seen(page.getByRole('heading', { name: 'Welcome back' })));
  await nav(page, 'Classes');
  check('  and other screens work', await seen(page.getByRole('button', { name: '+ Create class' })));
  await nav(page, 'Staff');
  check('  and the Staff screen says update 0010 is needed', await seen(page.getByText(/needs database update 0010/)));
});

// An ended, unpaid period so reminders appear (the parent has not yet agreed to WhatsApp).
const parentOfKid = db.academy_guardians.find(g => g.phone_e164 === '+251911000000');
if (parentOfKid) { parentOfKid.email = 'p@example.com'; parentOfKid.email_opt_in = true; }
db.academy_fee_period_status.push({ id: uid(seq++), guardian_id: parentOfKid?.id, learner_id: null, period_start: '2026-05-01', period_end: '2026-08-01', course_count: 1, amount_due: 150, currency_code: 'USD',
  reported_status: 'unpaid', paid_on: null, paid_method: null, paid_note: null, checked_status: 'unpaid', approved_status: 'unpaid', status: 'overdue', stage: 'none' });

await session(browser, db, 'teacher', 390, async page => {
  const sections = await page.getByRole('navigation', { name: 'Sections' }).getByRole('button').allInnerTexts();
  check('teacher sees teacher sections only', JSON.stringify(sections) === JSON.stringify(['Overview', 'Students', 'Guardians', 'Classes', 'Attendance', 'Fees', 'Notices', 'My profile']), sections.join(','));
  await nav(page, 'My profile');
  const myp = page.getByRole('region', { name: 'Profile of Teacher Test' });
  check('teacher opens My profile with their own class and lessons', await seen(myp.getByRole('heading', { name: 'Teacher Test' }))
    && await seen(myp.getByRole('region', { name: 'Classes of this teacher' }).getByRole('cell', { name: 'English – Level 3' }))
    && await seen(myp.getByRole('img', { name: /^Bar chart of lessons per month/ })));
  check('My profile shows attendance still to finish, and no close button or sign-in date', await seen(myp.getByText(/of \d+ marked/).first())
    && (await myp.getByRole('button', { name: 'Close profile' }).count()) === 0 && (await myp.getByText(/^Last signed in/).count()) === 0);
  if (process.env.SCREENSHOTS) await page.screenshot({ path: `${process.env.SCREENSHOTS}/teacher-my-profile.png`, fullPage: true });
  check('teacher cannot add students', (await nav(page, 'Students'), await page.getByRole('button', { name: '+ Add student' }).count()) === 0);
  await page.getByRole('row', { name: /^Kid Test/ }).getByRole('button', { name: 'Profile', exact: true }).click();
  const tsp = page.getByRole('region', { name: 'Profile of Kid Test' });
  check('teacher opens a student profile and sees the parent (verified contacts only)', await seen(tsp.getByRole('region', { name: 'Parents' }).getByText('Parent Test')));
  check('teacher sees no payment history in the student profile', (await tsp.getByRole('region', { name: 'Payment history' }).count()) === 0);
  await tsp.getByRole('button', { name: 'Close profile' }).click();
  await nav(page, 'Fees');
  check('teacher sees the parent payment with phone', await seen(page.getByText('+251911000000').first()));
  check('teacher has a Report payment button', await seen(page.getByRole('button', { name: 'Report payment' }).first()));
  check('no WhatsApp button without the parent\'s permission', (await page.getByRole('link', { name: 'Send on WhatsApp' }).count()) === 0);
  await page.getByRole('button', { name: 'Record WhatsApp permission' }).click();
  await page.getByRole('button', { name: 'Confirm: parent agreed to WhatsApp' }).click();
  const wa = page.getByRole('link', { name: 'Send on WhatsApp' });
  check('after recording permission the WhatsApp button appears', await seen(wa));
  const href = await wa.getAttribute('href');
  check('WhatsApp link has the parent number and the reminder text', /^https:\/\/wa\.me\/251911000000\?text=Dear%20/.test(href ?? '') && decodeURIComponent(href ?? '').includes('USD 150'), href ?? '');
  await wa.evaluate(a => a.removeAttribute('target'));
  await page.route('https://wa.me/**', r => r.fulfill({ status: 200, body: 'whatsapp' }));
  await Promise.all([page.waitForURL('https://wa.me/**').catch(() => {}), wa.click()]);
  await page.goBack();
  await page.getByText('Live database').waitFor({ timeout: 10000 }).catch(() => {});
  await nav(page, 'Fees');
  check('the reminder date is recorded', await seen(page.getByText(/^Reminded \d{2}\/\d{2}\/\d{4}/)));
  await nav(page, 'Notices');
  await page.getByRole('combobox', { name: /^Class/ }).selectOption({ index: 1 });
  await page.getByLabel('Last day of this level').fill('2026-11-10');
  check('notice says the level ends, the one-week break and the next start', await seen(page.getByText(/finishes on 10\/11\/2026\. After that there is a one-week break\. The next level (\(English – Level 4\) )?starts on 18\/11\/2026/)));
  const share = await page.getByRole('link', { name: 'Share on WhatsApp' }).getAttribute('href');
  check('notice opens WhatsApp to choose the class group', (share ?? '').startsWith('https://wa.me/?text=Dear%20parents'), share ?? '');
  await nav(page, 'Guardians');
  await page.getByRole('combobox', { name: /^Student/ }).selectOption({ label: 'Kid Test' });
  await page.getByLabel('Guardian name').fill('Second Parent');
  await page.getByLabel('Email', { exact: true }).fill('second@example.com');
  await page.getByRole('button', { name: '+ Add guardian' }).click();
  check('teacher-added parent starts as pending', await seen(page.getByText('Pending', { exact: true })));
  check('teacher does not see the all-parents directory', (await page.getByLabel('All parents').count()) === 0);
});

await session(browser, db, 'finance', 390, async page => {
  check('finance lands on Fees', await seen(page.getByRole('heading', { name: 'Parent payment periods' })));
  check('finance has no Approve button', (await page.getByRole('button', { name: /^Approve/ }).count()) === 0);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download payments (CSV)' }).click()]);
  const csvText = await (await import('node:fs')).promises.readFile(await download.path(), 'utf8');
  check('finance downloads payments as CSV for Google Sheets', /^bigchange-payments-\d{4}-\d{2}-\d{2}\.csv$/.test(download.suggestedFilename())
    && csvText.includes('"Child","Parent","Parent phone"') && csvText.includes("'+251911000000"), download.suggestedFilename());
  await nav(page, 'Students');
  await page.getByRole('row', { name: /^Kid Test/ }).getByRole('button', { name: 'Profile', exact: true }).click();
  const fsp = page.getByRole('region', { name: 'Profile of Kid Test' });
  check('finance sees payment history but no attendance in the student profile', await seen(fsp.getByRole('region', { name: 'Payment history' }))
    && (await fsp.getByRole('region', { name: 'Attendance calendar' }).count()) === 0);
  await fsp.getByRole('button', { name: 'Close profile' }).click();
  await nav(page, 'Fees');
  const nextList = page.getByRole('region', { name: 'Children who need the next 3 months' });
  check('finance sees the imported child who needs their first 3 months, not children already covered',
    await seen(nextList.getByRole('row', { name: /Import Kid One/ })) && (await nextList.getByRole('row', { name: /Kid Test/ }).count()) === 0);
  if (process.env.SCREENSHOTS) await nextList.screenshot({ path: `${process.env.SCREENSHOTS}/finance-next-periods.png` });
  await nextList.getByRole('button', { name: 'Start next 3 months for Import Kid One' }).click();
  await page.getByText(/^Started for Import Kid One: 3 months from /).waitFor();
  check('finance starts the next 3 months from the list; the child leaves the list',
    (await page.getByRole('region', { name: 'Children who need the next 3 months' }).getByRole('row', { name: /Import Kid One/ }).count()) === 0
    && db.academy_fee_period_status.some(p => p.learner_id === db.academy_learners.find(l => l.display_name === 'Import Kid One')?.id));
  check('finance sees the parents-to-remind list', await seen(page.getByRole('heading', { name: /Parents to remind \(\d+\)/ })));
  check('finance list shows the WhatsApp button and last reminder', await seen(page.getByLabel('Parents to remind').getByRole('link', { name: 'Send on WhatsApp' })) && await seen(page.getByLabel('Parents to remind').getByText(/^Reminded /)));
  check('finance can copy numbers for a broadcast list', await seen(page.getByRole('button', { name: /Copy WhatsApp numbers \(1\)/ })));
  const mail = await page.getByRole('link', { name: 'Email 1 parent' }).getAttribute('href').catch(() => null);
  check('finance bulk email opens their email app with parents in BCC', (mail ?? '').startsWith('mailto:?bcc=p%40example.com&subject='), mail ?? 'no link');
});

await session(browser, db, 'admin', 1366, async page => {
  await nav(page, 'Guardians');
  check('admin sees the pending-verification count', await seen(page.getByText('1 link waiting for verification')));
  await page.getByLabel('Only parents waiting for verification').check();
  check('pending filter shows only the waiting parent', (await page.getByLabel('All parents').getByRole('row').count()) === 2);
  await page.getByLabel('All parents').getByRole('button', { name: 'Verify' }).click();
  check('admin verifies from the directory', await seen(page.getByText(/^Verified Second Parent/)));
  await page.getByLabel('Search parents').fill('second@');
  await page.getByLabel('Only parents waiting for verification').uncheck();
  check('directory search by email', (await page.getByLabel('All parents').getByRole('row').count()) === 2);
});

// Optional accessibility scan with axe-core: AXE_PATH=/path/to/axe.min.js node tests/e2e/live-smoke.mjs ...
// Parent and student (read-only views). The parent record is linked to the guardian login; the first student to the learner login.
const parentLogin = db.academy_guardians.find(g => g.phone_e164 === '+251911000000');
if (parentLogin) { db.academy_guardians.find(g => g.auth_user_id === USERS.guardian).auth_user_id = null; parentLogin.auth_user_id = USERS.guardian; }
const kid = db.academy_learners.find(l => l.display_name === 'Kid Test');
if (kid) kid.auth_user_id = USERS.learner;

await session(browser, db, 'guardian', 390, async page => {
  const sections = await page.getByRole('navigation', { name: 'Sections' }).getByRole('button').allInnerTexts();
  check('parent sees only My children and Payments', JSON.stringify(sections) === JSON.stringify(['My children', 'Payments']), sections.join(','));
  check('parent sees their child, classes and attendance', await seen(page.getByRole('heading', { name: 'Kid Test' })) && await seen(page.getByText(/Attendance rate/)));
  check('parent has no add or edit buttons', (await page.getByRole('button', { name: /^\+|Edit|Save|Report|Approve|Check/ }).count()) === 0);
  await nav(page, 'Payments');
  check('parent sees their payments in dollars', await seen(page.getByRole('heading', { name: 'My payments' })) && await seen(page.getByText(/USD \d+/)));
  if (process.env.AXE_PATH) for (const name of ['My children', 'Payments']) {
    await nav(page, name); await page.waitForTimeout(300);
    if (process.env.SCREENSHOTS) await page.screenshot({ path: `${process.env.SCREENSHOTS}/guardian-${name.toLowerCase().replace(' ', '-')}.png` });
    await page.addScriptTag({ path: process.env.AXE_PATH });
    const v = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => x.id));
    check(`axe guardian ${name}: no serious/critical issues`, v.length === 0, v.join(' | '));
  }
});

await session(browser, db, 'learner', 1366, async page => {
  const sections = await page.getByRole('navigation', { name: 'Sections' }).getByRole('button').allInnerTexts();
  check('student sees only My classes', JSON.stringify(sections) === JSON.stringify(['My classes']), sections.join(','));
  check('student sees their classes and attendance', await seen(page.getByText(/English – Level 3/)) && await seen(page.getByText(/Attendance rate/)));
  check('student sees no payments and no edit buttons', (await page.getByText(/USD/).count()) === 0 && (await page.getByRole('button', { name: /^\+|Edit|Save|Report/ }).count()) === 0);
  if (process.env.AXE_PATH) {
    await page.addScriptTag({ path: process.env.AXE_PATH });
    const v = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => x.id));
    check('axe student My classes: no serious/critical issues', v.length === 0, v.join(' | '));
  }
});

if (process.env.AXE_PATH) {
  // Sign-in screen (before signing in), at phone and desktop width.
  for (const width of [390, 1366]) {
    const p = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
    await p.goto(BASE); await p.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
    if (process.env.SCREENSHOTS) await p.screenshot({ path: `${process.env.SCREENSHOTS}/signin-${width}.png` });
    await p.addScriptTag({ path: process.env.AXE_PATH });
    const v = await p.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations
      .filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => x.id));
    check(`axe sign-in @${width}px: no serious/critical issues`, v.length === 0, v.join(' | '));
    await p.context().close();
  }
  for (const [role, sections] of [['admin', ['Overview', 'Students', 'Guardians', 'Courses', 'Classes', 'Attendance', 'Fees', 'Staff', 'Reports']], ['teacher', ['Overview', 'Classes', 'Fees', 'Notices', 'My profile']], ['finance', ['Fees', 'Overview', 'Guardians']]]) {
    await session(browser, db, role, role === 'teacher' ? 390 : 1366, async page => {
      for (const name of sections) {
        await nav(page, name);
        await page.waitForTimeout(300);
        if (process.env.SCREENSHOTS) await page.screenshot({ path: `${process.env.SCREENSHOTS}/${role}-${name.toLowerCase()}.png` });
        await page.addScriptTag({ path: process.env.AXE_PATH });
        const v = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations
          .filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => x.id + ' (' + x.nodes.length + '): ' + x.nodes.slice(0, 2).map(n => n.target.join(' ') + ' ' + (n.any[0]?.message ?? '')).join(', ')));
        check(`axe ${role} ${name}: no serious/critical issues`, v.length === 0, v.join(' | '));
      }
    });
  }
}

await browser.close();
console.log(results.join('\n'));
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
