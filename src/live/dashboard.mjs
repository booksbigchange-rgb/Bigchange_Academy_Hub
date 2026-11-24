// Numbers for the Overview charts (design A + heat calendar). Pure functions over the data the app already loads;
// each role only ever sees what the database lets it read.

const pad = n => String(n).padStart(2, '0');
/** Local calendar day (YYYY-MM-DD) of a timestamp or Date. */
export const dayOf = d => { const x = new Date(d); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); };
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return dayOf(d); };
/** Monday of the week that contains `iso`. */
export const mondayOf = iso => { const d = new Date(iso + 'T12:00:00'); return addDays(iso, -((d.getDay() + 6) % 7)); };

/**
 * Payment status of each child's (or old family-wide) CURRENT period: the latest one that has started.
 * Returns { paid, partial, unpaid, overdue, total }.
 */
export function paymentStatusCounts(periods, today) {
  const latest = new Map();
  for (const p of periods) {
    if (p.period_start > today) continue;
    const key = p.learner_id ?? 'family:' + p.guardian_id;
    const cur = latest.get(key);
    if (!cur || p.period_start > cur.period_start) latest.set(key, p);
  }
  const out = { paid: 0, partial: 0, unpaid: 0, overdue: 0, total: 0 };
  for (const p of latest.values()) { if (p.status in out) { out[p.status]++; out.total++; } }
  return out;
}

/** Active students per course (a student counts once per course), largest first; past `max` rows the rest fold into "Other courses". */
export function studentsPerCourse({ learners, enrollments, classes, courses }, max = 6) {
  const active = new Set(learners.filter(l => l.active).map(l => l.id));
  const courseOfClass = new Map(classes.map(c => [c.id, c.course_id]));
  const sets = new Map();
  for (const e of enrollments) {
    if (!active.has(e.learner_id)) continue;
    const course = courseOfClass.get(e.class_id); if (!course) continue;
    if (!sets.has(course)) sets.set(course, new Set());
    sets.get(course).add(e.learner_id);
  }
  const rows = [...sets].map(([id, s]) => ({ label: courses.find(c => c.id === id)?.title ?? 'Course', count: s.size }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  if (rows.length <= max) return rows;
  const other = rows.slice(max - 1).reduce((n, r) => n + r.count, 0);
  return [...rows.slice(0, max - 1), { label: 'Other courses', count: other }];
}

/** Rate = present + late over present + late + absent (excused lessons are not counted), in whole percent; null if nothing marked. */
function rateOf(marks) {
  let ok = 0, all = 0;
  for (const m of marks) { if (m === 'excused') continue; all++; if (m === 'present' || m === 'late') ok++; }
  return all ? Math.round((ok / all) * 100) : null;
}
function marksByDay({ attendance, sessions }) {
  const dayOfSession = new Map(sessions.map(s => [s.id, dayOf(s.starts_at)]));
  const byDay = new Map();
  for (const a of attendance) {
    const day = dayOfSession.get(a.session_id); if (!day) continue;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(a.status);
  }
  return byDay;
}

/** Attendance rate for each of the last `weeks` weeks (Monday to Sunday), oldest first. */
export function weeklyAttendance(data, today, weeks = 8) {
  const byDay = marksByDay(data);
  const thisMonday = mondayOf(today);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(thisMonday, -7 * (weeks - 1 - i));
    const marks = Array.from({ length: 7 }, (_, d) => byDay.get(addDays(start, d)) ?? []).flat();
    return { weekStart: start, rate: rateOf(marks), marked: marks.length };
  });
}

/** Attendance rate over the last `days` days, and over the `days` before that (for the "up/down" note). */
export function attendanceRecent(data, today, days = 28) {
  const byDay = marksByDay(data);
  const range = (from, n) => Array.from({ length: n }, (_, d) => byDay.get(addDays(from, d)) ?? []).flat();
  return { rate: rateOf(range(addDays(today, -(days - 1)), days)), before: rateOf(range(addDays(today, -(2 * days - 1)), days)) };
}

/** Heat calendar: the last `weeks` weeks, Monday to Sunday, each day { date, rate, marked, future }. */
export function attendanceCalendar(data, today, weeks = 4) {
  const byDay = marksByDay(data);
  const first = addDays(mondayOf(today), -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => {
    const date = addDays(first, w * 7 + d);
    const marks = byDay.get(date) ?? [];
    return { date, rate: rateOf(marks), marked: marks.length, future: date > today };
  }));
}

/** Colour step for a heat-calendar day: 0 (no lesson) … 5 (95% or more). Same blue scale, light to dark. */
export function heatStep(rate) {
  if (rate === null || rate === undefined) return 0;
  return rate >= 95 ? 5 : rate >= 90 ? 4 : rate >= 85 ? 3 : rate >= 80 ? 2 : 1;
}

/** Stroke dash pieces for a donut of `values` on a circle of circumference `c`, with a `gap` between slices. */
export function donutSlices(values, c, gap = 2) {
  const total = values.reduce((n, v) => n + v, 0);
  if (!total) return [];
  let at = 0;
  return values.map(v => {
    const len = (v / total) * c;
    const slice = { dash: Math.max(len - (values.filter(x => x > 0).length > 1 ? gap : 0), 0), offset: -at, value: v };
    at += len;
    return slice;
  });
}

/** The part of the data that belongs to one teacher's classes (for reusing the attendance charts). */
export function dataForTeacher(data, staffId) {
  const classIds = new Set(data.classes.filter(c => c.teacher_staff_id === staffId).map(c => c.id));
  const sessions = data.sessions.filter(s => classIds.has(s.class_id));
  const sessionIds = new Set(sessions.map(s => s.id));
  return { ...data, classes: data.classes.filter(c => classIds.has(c.id)), sessions,
    attendance: data.attendance.filter(a => sessionIds.has(a.session_id)), enrollments: data.enrollments.filter(e => classIds.has(e.class_id)) };
}

/**
 * Teacher profile numbers: their classes (students, 4-week attendance, level end), distinct active students,
 * lessons this month, lessons per month for the last `months` months, and recent lessons (last 30 days, already
 * held) where fewer students were marked than are enrolled in the class now.
 */
export function teacherStats(data, staffId, now = new Date(), months = 6) {
  const today = dayOf(now);
  const mine = dataForTeacher(data, staffId);
  const active = new Set(data.learners.filter(l => l.active).map(l => l.id));
  const enrolled = id => mine.enrollments.filter(e => e.class_id === id && active.has(e.learner_id)).length;
  const courseTitle = id => data.courses.find(c => c.id === id)?.title ?? '—';
  const classes = mine.classes.map(c => {
    const own = dataForTeacher({ ...data, classes: [c] }, staffId);
    return { id: c.id, title: c.title, course: courseTitle(c.course_id), students: enrolled(c.id), rate: attendanceRecent(own, today).rate, levelEnd: c.level_end ?? null };
  }).sort((a, b) => a.title.localeCompare(b.title));
  const students = new Set(mine.enrollments.filter(e => active.has(e.learner_id)).map(e => e.learner_id)).size;
  const monthKey = d => dayOf(d).slice(0, 7);
  const thisMonth = monthKey(now);
  const monthly = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const key = monthKey(d);
    return { month: key, label: d.toLocaleDateString('en-GB', { month: 'short' }), count: mine.sessions.filter(s => monthKey(s.starts_at) === key).length };
  });
  const since = addDays(today, -30);
  const titleOf = id => mine.classes.find(c => c.id === id)?.title ?? 'Class';
  const missing = mine.sessions
    .filter(s => new Date(s.starts_at) <= now && dayOf(s.starts_at) >= since)
    .map(s => ({ sessionId: s.id, date: dayOf(s.starts_at), classTitle: titleOf(s.class_id), marked: mine.attendance.filter(a => a.session_id === s.id).length, enrolled: enrolled(s.class_id) }))
    .filter(x => x.enrolled > 0 && x.marked < x.enrolled)
    .sort((a, b) => b.date.localeCompare(a.date));
  return { classes, students, lessonsThisMonth: mine.sessions.filter(s => monthKey(s.starts_at) === thisMonth).length,
    rate: attendanceRecent(mine, today).rate, monthly, missing };
}

/** The part of the data that belongs to one student (their own attendance marks, for reusing the attendance charts). */
export function dataForLearner(data, learnerId) {
  const attendance = data.attendance.filter(a => a.learner_id === learnerId);
  const ids = new Set(attendance.map(a => a.session_id));
  return { ...data, attendance, sessions: data.sessions.filter(s => ids.has(s.id)) };
}

/**
 * Student profile numbers: their classes (course, teacher, level dates, their own attendance in that class),
 * their 4-week and overall attendance, their payment periods (newest first, with the current one), and the
 * parents linked to them in the data this role can read.
 */
export function studentStats(data, learnerId, today) {
  const mine = dataForLearner(data, learnerId);
  const classIds = data.enrollments.filter(e => e.learner_id === learnerId).map(e => e.class_id);
  const courseTitle = id => data.courses.find(c => c.id === id)?.title ?? '—';
  const teacherName = id => (id ? data.staff.find(s => s.id === id)?.display_name ?? null : null);
  const classes = data.classes.filter(c => classIds.includes(c.id)).map(c => {
    const own = { ...mine, sessions: mine.sessions.filter(s => s.class_id === c.id) };
    own.attendance = mine.attendance.filter(a => own.sessions.some(s => s.id === a.session_id));
    return { id: c.id, title: c.title, course: courseTitle(c.course_id), teacherId: c.teacher_staff_id, teacher: teacherName(c.teacher_staff_id),
      levelStart: c.level_start ?? null, levelEnd: c.level_end ?? null, rate: attendanceRecent(own, today, 3650).rate, lessons: own.attendance.length };
  }).sort((a, b) => a.title.localeCompare(b.title));
  const periods = data.periods.filter(p => p.learner_id === learnerId).slice().sort((a, b) => b.period_start.localeCompare(a.period_start));
  const current = periods.find(p => p.period_start <= today) ?? null;
  const guardians = data.links.filter(l => l.learner_id === learnerId).map(l => {
    const g = data.guardians.find(x => x.id === l.guardian_id);
    return g ? { id: g.id, name: g.display_name, phone: g.phone_e164, email: g.email, whatsapp: g.whatsapp_opt_in, emailOk: g.email_opt_in, verified: l.verified } : null;
  }).filter(Boolean);
  return { classes, recent: attendanceRecent(mine, today), overall: attendanceRecent(mine, today, 3650).rate, marks: mine.attendance.length, periods, current, guardians };
}

/**
 * Lessons in one month (YYYY-MM, by the lesson's local day), one row per teacher (the class's CURRENT teacher;
 * classes with none are grouped as "No teacher"): classes taught, lessons held, lessons fully marked, lessons held
 * but not fully marked (fewer marks than students enrolled now), lessons still to come, and the attendance rate.
 * Also returns every lesson of the month for the detailed download. Admin data only (it needs attendance).
 */
export function lessonsByTeacher(data, month, now = new Date()) {
  const active = new Set(data.learners.filter(l => l.active).map(l => l.id));
  const enrolled = id => data.enrollments.filter(e => e.class_id === id && active.has(e.learner_id)).length;
  const classById = new Map(data.classes.map(c => [c.id, c]));
  const nameOf = id => (id ? data.staff.find(s => s.id === id)?.display_name ?? 'Teacher' : 'No teacher');
  const lessons = data.sessions.filter(s => dayOf(s.starts_at).slice(0, 7) === month && classById.has(s.class_id)).map(s => {
    const cls = classById.get(s.class_id);
    const marks = data.attendance.filter(a => a.session_id === s.id);
    const held = new Date(s.starts_at) <= now;
    const time = new Date(s.starts_at);
    return { sessionId: s.id, date: dayOf(s.starts_at), time: String(time.getHours()).padStart(2, '0') + ':' + String(time.getMinutes()).padStart(2, '0'),
      classId: cls.id, classTitle: cls.title, teacherId: cls.teacher_staff_id ?? null, teacher: nameOf(cls.teacher_staff_id),
      held, marked: marks.length, enrolled: enrolled(cls.id), statuses: marks.map(m => m.status) };
  }).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.classTitle.localeCompare(b.classTitle));
  const groups = new Map();
  for (const l of lessons) {
    const key = l.teacherId ?? '';
    if (!groups.has(key)) groups.set(key, { teacherId: l.teacherId, teacher: l.teacher, classes: new Set(), held: 0, complete: 0, incomplete: 0, upcoming: 0, statuses: [] });
    const g = groups.get(key);
    g.classes.add(l.classId);
    if (!l.held) { g.upcoming++; continue; }
    g.held++;
    if (l.enrolled > 0 && l.marked < l.enrolled) g.incomplete++; else g.complete++;
    g.statuses.push(...l.statuses);
  }
  const rows = [...groups.values()].map(g => ({ teacherId: g.teacherId, teacher: g.teacher, classes: g.classes.size, held: g.held,
    complete: g.complete, incomplete: g.incomplete, upcoming: g.upcoming, rate: rateOf(g.statuses) }))
    .sort((a, b) => (a.teacherId === null) - (b.teacherId === null) || b.held - a.held || a.teacher.localeCompare(b.teacher));
  const total = rows.reduce((t, r) => ({ held: t.held + r.held, complete: t.complete + r.complete, incomplete: t.incomplete + r.incomplete, upcoming: t.upcoming + r.upcoming }),
    { held: 0, complete: 0, incomplete: 0, upcoming: 0 });
  return { rows, lessons, total };
}
