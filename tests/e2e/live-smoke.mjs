// Browser smoke test of the LIVE screens against a fake, in-memory Supabase (no real project is contacted).
// It checks that each role's screens render, the main buttons perform real calls, and nothing overflows on a phone.
// Database rules are tested separately in tests/sql/run_rls_tests.sh; this test only exercises the UI wiring.
//
// Usage (Playwright is not a project dependency):
//   npm i --no-save playwright            (or install it anywhere and set NODE_PATH)
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
      { id: uid(1), auth_user_id: uid(901), role: 'admin', display_name: 'Admin Test' },
      { id: uid(2), auth_user_id: uid(902), role: 'teacher', display_name: 'Teacher Test' },
      { id: uid(3), auth_user_id: uid(903), role: 'finance', display_name: 'Finance Test' }],
    academy_learners: [], academy_guardians: [{ id: uid(40), auth_user_id: uid(904), display_name: 'Parent Test', email: 'p@example.com', phone_e164: '+251911000000', email_opt_in: true, whatsapp_opt_in: false }],
    academy_learners_seed: [], academy_courses: [], academy_classes: [], academy_enrollments: [], academy_sessions: [],
    academy_attendance: [], academy_guardian_links: [], academy_fee_period_status: []
  };
}
const USERS = { admin: uid(901), teacher: uid(902), finance: uid(903), guardian: uid(904) };

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
        Object.assign(p, { reported_status: a.p_status, paid_on: a.p_paid_on, paid_method: a.p_method, paid_note: a.p_note, stage: a.p_status === 'unpaid' ? 'none' : 'reported', checked_status: 'unpaid', approved_status: 'unpaid', status: 'unpaid' });
        return route.fulfill({ status: 204 });
      }
      if (fn === 'academy_teacher_fee_periods') return json(db.academy_fee_period_status.map(p => { const g = db.academy_guardians.find(x => x.id === p.guardian_id) ?? {}; return { period_id: p.id, guardian_id: p.guardian_id, guardian_name: g.display_name ?? 'Parent Test', guardian_phone: g.phone_e164 ?? null,
        period_start: p.period_start, period_end: p.period_end, amount_due: p.amount_due, status: p.status, stage: p.stage, reported_status: p.reported_status, paid_on: p.paid_on, paid_method: p.paid_method, paid_note: p.paid_note, students: ['Kid Test'], courses: ['Course Test'],
        whatsapp_opt_in: Boolean(g.whatsapp_opt_in), last_reminded_at: (db.academy_reminder_events ?? []).filter(r => r.period_id === p.id).map(r => r.sent_at).sort().pop() ?? null }; }));
      if (fn === 'academy_set_guardian_consent') { const g = db.academy_guardians.find(x => x.id === a.p_guardian); g.email_opt_in = a.p_email_opt ?? g.email_opt_in; g.whatsapp_opt_in = a.p_whatsapp_opt ?? g.whatsapp_opt_in; return route.fulfill({ status: 204 }); }
      if (fn === 'academy_log_reminder') {
        const p = db.academy_fee_period_status.find(x => x.id === a.p_period); const g = db.academy_guardians.find(x => x.id === p.guardian_id);
        if (a.p_channel === 'whatsapp' && !g.whatsapp_opt_in) return json({ message: 'This parent has not agreed to WhatsApp messages' }, 400);
        (db.academy_reminder_events ??= []).push({ id: uid(seq++), period_id: p.id, sent_at: new Date().toISOString() }); return json(new Date().toISOString());
      }
      return json({ message: 'unknown rpc ' + fn }, 404);
    }
    if (path.startsWith('/rest/v1/')) {
      let table = path.slice('/rest/v1/'.length);
      const store = table === 'academy_fee_periods' ? 'academy_fee_period_status' : table;
      const rows = db[store] ?? (db[store] = []);
      const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
      if (method === 'GET') {
        let out = filterRows(rows, url.searchParams);
        if (table === 'academy_guardians' && role === 'guardian') out = out.filter(g => g.auth_user_id === user.id);
        if (table === 'academy_staff' || table === 'academy_learners' || table === 'academy_guardians') {
          if (url.searchParams.get('auth_user_id')) out = out.filter(r => r.auth_user_id === url.searchParams.get('auth_user_id').slice(3));
        }
        if (single) return out.length ? json(out[0]) : json({ code: 'PGRST116', message: 'no rows' }, 406);
        return json(out);
      }
      if (method === 'POST') {
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
  await page.getByRole('button', { name: 'Sign in' }).click();
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
  await page.getByLabel('Date').fill('2026-11-02');
  await page.getByRole('button', { name: '+ Add lesson' }).click();
  check('duplicate lesson on the same day is refused', await seen(page.getByText(/already has a lesson/)));
  await nav(page, 'Guardians');
  await page.getByRole('combobox', { name: /^Student/ }).selectOption({ label: 'Kid Test' });
  check('the parent from the student form is linked, verified, phone normalised',
    await seen(page.getByRole('cell', { name: '+251911000000' })) && await seen(page.getByText('Verified', { exact: true })));
  await nav(page, 'Fees');
  await page.getByRole('combobox', { name: /^Child/ }).selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Show fee' }).click();
  check('fee preview shows the child and USD 150', await seen(page.getByText(/Kid Test: 1 course.*USD 150/).first()));
  await page.getByRole('button', { name: 'Start 3 months' }).click();
  await page.getByRole('button', { name: 'Report', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Report', exact: true }).click();
  await page.getByLabel('How they paid').selectOption('cash');
  await page.getByLabel('Note or reference (optional, max 120)').fill('Receipt 1');
  await page.getByRole('button', { name: 'Save report' }).click();
  await page.getByRole('button', { name: /^Check/ }).waitFor();
  check('payment report moves to "awaiting finance check"', await seen(page.getByText('Reported, awaiting finance check')));
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
  await nav(page, 'Overview');
  check('overview cards render', (await page.locator('.metric').count()) === 4);
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
});

// An ended, unpaid period so reminders appear (the parent has not yet agreed to WhatsApp).
const parentOfKid = db.academy_guardians.find(g => g.phone_e164 === '+251911000000');
if (parentOfKid) { parentOfKid.email = 'p@example.com'; parentOfKid.email_opt_in = true; }
db.academy_fee_period_status.push({ id: uid(seq++), guardian_id: parentOfKid?.id, learner_id: null, period_start: '2026-05-01', period_end: '2026-08-01', course_count: 1, amount_due: 150, currency_code: 'USD',
  reported_status: 'unpaid', paid_on: null, paid_method: null, paid_note: null, checked_status: 'unpaid', approved_status: 'unpaid', status: 'overdue', stage: 'none' });

await session(browser, db, 'teacher', 390, async page => {
  const sections = await page.getByRole('navigation', { name: 'Sections' }).getByRole('button').allInnerTexts();
  check('teacher sees teacher sections only', JSON.stringify(sections) === JSON.stringify(['Overview', 'Students', 'Guardians', 'Classes', 'Attendance', 'Fees', 'Notices']), sections.join(','));
  check('teacher cannot add students', (await nav(page, 'Students'), await page.getByRole('button', { name: '+ Add student' }).count()) === 0);
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
if (process.env.AXE_PATH) {
  for (const [role, sections] of [['admin', ['Overview', 'Students', 'Guardians', 'Courses', 'Classes', 'Attendance', 'Fees']], ['teacher', ['Fees']]]) {
    await session(browser, db, role, 1366, async page => {
      for (const name of sections) {
        await nav(page, name);
        await page.waitForTimeout(300);
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
