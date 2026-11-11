/** Input validation for the live (database-backed) screens. Pure; mirrors database constraints. */
export const GRADE_LEVELS = Object.freeze(['Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10']);
const clean = v => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');
const unsafe = /[<>]/;

export function validateLearner({ name, gradeLevel = '', note = '' }) {
  const displayName = clean(name), n = clean(note), grade = clean(gradeLevel);
  if (displayName.length < 2 || displayName.length > 80) throw Error('Enter the student’s name (2 to 80 characters)');
  if (unsafe.test(displayName) || unsafe.test(n)) throw Error('Names and notes cannot contain < or >');
  if (n.length > 120) throw Error('Notes can be at most 120 characters');
  if (grade && !GRADE_LEVELS.includes(grade)) throw Error('Choose a valid grade level');
  return { display_name: displayName, grade_level: grade || null, note: n || null };
}

export function validateCourse({ title, description = '' }) {
  const t = clean(title), d = clean(description);
  if (t.length < 2 || t.length > 80) throw Error('Enter a course title (2 to 80 characters)');
  if (unsafe.test(t) || unsafe.test(d)) throw Error('Text cannot contain < or >');
  if (d.length > 300) throw Error('Description can be at most 300 characters');
  return { title: t, description: d || null };
}

export function validateClass({ title, courseId, teacherId = "" }) {
  const t = clean(title);
  if (t.length < 2 || t.length > 80) throw Error('Enter a class title (2 to 80 characters)');
  if (unsafe.test(t)) throw Error('Text cannot contain < or >');
  if (!courseId) throw Error('Choose a course');
  return { title: t, course_id: courseId, teacher_staff_id: teacherId || null };
}

/** Case-insensitive search over name fields. */
export function matchesSearch(text, query) {
  return clean(text).toLowerCase().includes(clean(query).toLowerCase());
}

/** Returns an error message if the learner cannot be enrolled in the class, else ''. */
export function enrollmentProblem({ learnerId, classId, enrollments, learners }) {
  const learner = learners.find(l => l.id === learnerId);
  if (!learner) return 'Choose a student';
  if (learner.active === false) return 'This student is inactive';
  if (!classId) return 'Choose a class';
  if (enrollments.some(e => e.class_id === classId && e.learner_id === learnerId)) return 'Already enrolled in this class';
  return '';
}

export const ATTENDANCE_STATUSES = Object.freeze(['present', 'late', 'absent', 'excused']);

/** Validate a lesson date (YYYY-MM-DD, real calendar date) and time (HH:MM). Returns an ISO timestamp. */
export function validateSession({ date, time }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw Error('Choose a lesson date');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) throw Error('Choose a lesson time');
  const when = new Date(date + 'T' + time);
  if (Number.isNaN(when.getTime())) throw Error('Choose a valid date');
  const check = new Date(date + 'T00:00:00Z');
  if (Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== date) throw Error('Choose a valid date');
  const year = Number(date.slice(0, 4));
  if (year < 2020 || year > 2100) throw Error('Choose a date between 2020 and 2100');
  return when.toISOString();
}

/** Local calendar day (YYYY-MM-DD) of an ISO timestamp. */
export function localDay(iso) {
  const d = new Date(iso);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** True if the class already has a session on that local day. */
export function duplicateSession(sessions, classId, date) {
  return sessions.some(s => s.class_id === classId && localDay(s.starts_at) === date);
}

/**
 * Attendance summary. Rate = (present + late) / (present + late + absent); excused and unmarked are excluded.
 * @param {Array<{status:string}>} records
 */
export function attendanceSummary(records) {
  const count = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const r of records) if (r.status in count) count[r.status]++;
  const marked = count.present + count.late + count.absent;
  return { ...count, marked, rate: marked ? Math.round(((count.present + count.late) / marked) * 100) : null };
}

/** Normalise a phone number to E.164. Accepts Ethiopian local formats (09…/07…) and international (+…). */
export function normalizePhone(input) {
  const raw = clean(input).replace(/[\s().-]/g, '');
  if (!raw) return null;
  if (/^0[79]\d{8}$/.test(raw)) return '+251' + raw.slice(1);
  if (/^251[79]\d{8}$/.test(raw)) return '+' + raw;
  if (/^\+[1-9]\d{7,14}$/.test(raw)) return raw;
  throw Error('Enter the phone as 09XXXXXXXX or with country code, e.g. +2519XXXXXXXX');
}

export function validateGuardian({ name, email = '', phone = '', emailOptIn = false, whatsappOptIn = false }) {
  const n = clean(name), e = clean(email).toLowerCase();
  if (n.length < 2 || n.length > 80) throw Error('Enter the guardian’s name (2 to 80 characters)');
  if (unsafe.test(n)) throw Error('Names cannot contain < or >');
  if (e && !/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(e)) throw Error('Enter a valid email address');
  const p = normalizePhone(phone);
  if (!e && !p) throw Error('Enter a phone number or an email address');
  if (emailOptIn && !e) throw Error('Add an email address before ticking email permission');
  if (whatsappOptIn && !p) throw Error('Add a phone number before ticking WhatsApp permission');
  return { p_name: n, p_email: e || null, p_phone: p, p_email_opt: Boolean(emailOptIn), p_whatsapp_opt: Boolean(whatsappOptIn) };
}


/**
 * Validate a payment report; mirrors academy_report_payment. `today` is a YYYY-MM-DD string.
 * `methods` are the active payment-method codes from the admin's list. `amount` (USD) is optional.
 */
export function validateReport({ status, paidOn = '', method = '', note = '', amount = '' }, today, periodStart = '', methods = []) {
  if (!['unpaid', 'partial', 'paid'].includes(status)) throw Error('Choose unpaid, partly paid or paid');
  const n = clean(note);
  if (n.length > 120) throw Error('Note: up to 120 characters');
  if (unsafe.test(n)) throw Error('Notes cannot contain < or >');
  if (status === 'unpaid') return { p_status: 'unpaid', p_paid_on: null, p_method: null, p_note: n || null, p_amount: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) throw Error('Enter the date the parent paid');
  if (paidOn > today) throw Error('The payment date cannot be in the future');
  if (periodStart) {
    const earliest = new Date(periodStart + 'T00:00:00Z'); earliest.setUTCDate(earliest.getUTCDate() - 31);
    if (paidOn < earliest.toISOString().slice(0, 10)) throw Error('The payment date is too far before this period');
  }
  if (!methods.includes(method)) throw Error('Choose how the parent paid');
  const raw = String(amount ?? '').trim();
  const value = raw === '' ? null : Number(raw);
  if (value !== null && !(Number.isFinite(value) && value > 0 && value <= 100000)) throw Error('Enter an amount between 1 and 100000, or leave it empty');
  return { p_status: status, p_paid_on: paidOn, p_method: method, p_note: n || null, p_amount: value === null ? null : Math.round(value * 100) / 100 };
}

/** Dashboard counts from already-loaded, role-filtered data. Pure. */
export function overviewCounts({ learners, classes, guardians, links, periods, teacherPeriods, enrollments }) {
  const active = learners.filter(l => l.active).length;
  const pendingLinks = links.filter(l => !l.verified).length;
  const rows = periods.length ? periods : teacherPeriods.map(p => ({ status: p.status, stage: p.stage }));
  const unassigned = classes.filter(c => !c.teacher_staff_id).length;
  const empty = classes.filter(c => !enrollments.some(e => e.class_id === c.id)).length;
  return {
    activeStudents: active, inactiveStudents: learners.length - active, classes: classes.length, guardians: guardians.length,
    pendingLinks, unassignedClasses: unassigned, emptyClasses: empty,
    overdue: rows.filter(r => r.status === 'overdue').length,
    awaitingCheck: rows.filter(r => r.stage === 'reported').length,
    awaitingApproval: rows.filter(r => r.stage === 'checked').length
  };
}

/**
 * One student's attendance history, newest first, with a summary.
 * @param {string} learnerId
 * @param {{attendance:Array<{session_id:string,learner_id:string,status:string}>, sessions:Array<{id:string,class_id:string,starts_at:string}>, classes:Array<{id:string,title:string}>}} data
 * @returns {{rows:Array<{date:string,startsAt:string,classTitle:string,status:string}>, summary:ReturnType<typeof attendanceSummary>}}
 */
export function studentHistory(learnerId, { attendance, sessions, classes }) {
  const rows = attendance.filter(a => a.learner_id === learnerId).map(a => {
    const s = sessions.find(x => x.id === a.session_id);
    return s ? { date: localDay(s.starts_at), startsAt: s.starts_at, classTitle: classes.find(c => c.id === s.class_id)?.title ?? '—', status: a.status } : null;
  }).filter(r => r !== null).sort((x, y) => (x.startsAt < y.startsAt ? 1 : -1));
  return { rows, summary: attendanceSummary(rows) };
}

/**
 * Parent directory rows with verified and pending children.
 * @template {{id:string,display_name:string,phone_e164:string|null,email:string|null}} G
 * @param {{guardians:G[], links:Array<{guardian_id:string,learner_id:string,verified:boolean}>, learners:Array<{id:string,display_name:string}>}} data
 * @returns {Array<G & {verified:Array<{learnerId:string,name:string}>, pending:Array<{learnerId:string,name:string}>}>}
 */
export function parentDirectory({ guardians, links, learners }, query = '') {
  const q = clean(query).toLowerCase();
  const name = id => learners.find(l => l.id === id)?.display_name ?? 'Unknown student';
  return guardians.map(g => ({
    ...g,
    verified: links.filter(l => l.guardian_id === g.id && l.verified).map(l => ({ learnerId: l.learner_id, name: name(l.learner_id) })),
    pending: links.filter(l => l.guardian_id === g.id && !l.verified).map(l => ({ learnerId: l.learner_id, name: name(l.learner_id) }))
  })).filter(g => !q || [g.display_name, g.phone_e164 ?? '', g.email ?? '', ...g.verified.map(c => c.name), ...g.pending.map(c => c.name)].some(t => t.toLowerCase().includes(q)));
}
