import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  addClass, addCourse, addLearner, enroll, listClasses, listGuardians, listLinks, listPeriods, teacherPeriods, type Guardian, type GuardianLink, type PeriodRow, type TeacherPeriod, listCourses, listEnrollments, listLearners, listStaff,
  unenroll, updateLearner, setClassTeacher, listSessions, listAttendance, addSession, saveAttendance, type Session, type AttendanceRow, type AttendanceStatus, type ClassRow, type Course, type Enrollment, type Learner, type Staff
} from './api';
import { EMPTY, useAction, type Data, type PanelProps, type Role } from './shared';
import LiveGuardians from './LiveGuardians';
import LiveFees from './LiveFees';
import LiveOverview from './LiveOverview';
import LiveFamily, { LivePayments } from './LiveFamily';
import { ATTENDANCE_STATUSES, GRADE_LEVELS, attendanceSummary, duplicateSession, enrollmentProblem, localDay, matchesSearch } from './validation.mjs';

type Section = 'Overview' | 'Students' | 'Courses' | 'Classes' | 'Attendance' | 'Guardians' | 'Fees' | 'My children' | 'My classes' | 'Payments';

export default function LiveApp({ client, role, email, onSignOut }: { client: SupabaseClient; role: Role; email: string; onSignOut: () => void }) {
  const isAdmin = role === 'admin';
  const sections: Section[] = isAdmin ? ['Overview', 'Students', 'Guardians', 'Courses', 'Classes', 'Attendance', 'Fees']
    : role === 'teacher' ? ['Overview', 'Students', 'Guardians', 'Classes', 'Attendance', 'Fees']
    : role === 'finance' ? ['Fees', 'Overview', 'Guardians', 'Students']
    : role === 'guardian' ? ['My children', 'Payments'] : role === 'learner' ? ['My classes'] : [];
  const isFinance = role === 'finance';
  const [section, setSection] = useState<Section>(sections[0] ?? 'Overview');
  const [data, setData] = useState<Data>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const reload = useCallback(async () => {
    setLoadError('');
    try {
      const staffView = isAdmin || isFinance;
      const [learners, courses, staff, classes, enrollments, sessions, attendance, guardians, links, periods, teacherPeriodRows] = await Promise.all([
        listLearners(client), listCourses(client), isAdmin ? listStaff(client) : Promise.resolve([] as Staff[]),
        listClasses(client), listEnrollments(client), listSessions(client), listAttendance(client),
        staffView ? listGuardians(client) : Promise.resolve([] as Guardian[]),
        staffView ? listLinks(client) : Promise.resolve([] as GuardianLink[]),
        staffView || role === 'guardian' ? listPeriods(client) : Promise.resolve([] as PeriodRow[]),
        role === 'teacher' ? teacherPeriods(client) : Promise.resolve([] as TeacherPeriod[])]);
      setData({ learners, courses, staff, classes, enrollments, sessions, attendance, guardians, links, periods, teacherPeriods: teacherPeriodRows });
    } catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not load data'); }
    finally { setLoading(false); }
  }, [client, isAdmin, isFinance, role]);
  useEffect(() => { void reload(); }, [reload]);

  return <div className="shell">
    <aside className="sidebar">
      <div className="identity"><img className="brand-logo" src={`${import.meta.env.BASE_URL}bigchange-academy-logo.svg`} width="220" height="177" alt="BigChange Academy" /></div>
      <div className="side-label">WORKSPACE</div>
      <nav aria-label="Sections">
        {sections.map(item => <button key={item} className={section === item ? 'navitem active' : 'navitem'}
          aria-current={section === item ? 'page' : undefined} onClick={() => setSection(item)}>{item}</button>)}
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-note">Signed in · {role}</div></div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <nav className="crumb" aria-label="Breadcrumb">BigChange Academy <span aria-hidden="true">/</span> <span aria-current="page">{sections.length ? section : 'Account'}</span></nav>
        <div className="top-actions"><span>{email}</span> <button className="small-btn" onClick={onSignOut}>Sign out</button></div>
      </header>
      <main className="content live" id="main-content" tabIndex={-1}>
        <div role="note" className="notice"><strong>Live database</strong> — use test data only until the privacy and safeguarding checklist is complete. Changes are saved to the Academy database.</div>
        {!sections.length && <section className="panel"><h2>No screens yet for your role</h2>
          <p>Screens for the <strong>{role}</strong> role have not been built yet. Your account is verified, but nothing is available to you here for now.</p></section>}
        {sections.length > 0 && loading && <p role="status">Loading…</p>}
        {sections.length > 0 && loadError && <p className="ops-feedback" role="alert">{loadError} <button className="small-btn" onClick={() => void reload()}>Retry</button></p>}
        {sections.length > 0 && !loading && !loadError && <>
          {section === 'Overview' && <LiveOverview data={data} role={role} go={s => setSection(s as Section)} />}
          {(section === 'My children' || section === 'My classes') && <LiveFamily data={data} role={role} />}
          {section === 'Payments' && <LivePayments data={data} />}
          {section === 'Students' && <Students data={data} client={client} isAdmin={isAdmin} reload={reload} />}
          {section === 'Courses' && isAdmin && <Courses data={data} client={client} reload={reload} />}
          {section === 'Classes' && <Classes data={data} client={client} isAdmin={isAdmin} reload={reload} />}
          {section === 'Attendance' && <Attendance data={data} client={client} reload={reload} />}
          {section === 'Guardians' && <LiveGuardians data={data} client={client} role={role} reload={reload} />}
          {section === 'Fees' && <LiveFees data={data} client={client} role={role} reload={reload} />}
        </>}
      </main>
    </div>
  </div>;
}

function Students({ data, client, isAdmin, reload }: PanelProps & { isAdmin: boolean }) {
  const { message, busy, run } = useAction(reload);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [note, setNote] = useState('');
  const [editId, setEditId] = useState('');
  const [editName, setEditName] = useState('');
  const [editGrade, setEditGrade] = useState('');
  const [editNote, setEditNote] = useState('');
  const shown = data.learners.filter(l => matchesSearch(l.display_name, search));
  const editing = data.learners.find(l => l.id === editId);
  const classCount = (id: string) => data.enrollments.filter(e => e.learner_id === id).length;
  async function create(event: FormEvent) {
    event.preventDefault();
    if (await run(() => addLearner(client, { name, gradeLevel: grade, note }), 'Student added.')) { setName(''); setGrade(''); setNote(''); }
  }
  function startEdit(l: Learner) { setEditId(l.id); setEditName(l.display_name); setEditGrade(l.grade_level ?? ''); setEditNote(l.note ?? ''); }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (editing) await run(() => updateLearner(client, editing.id, { name: editName, gradeLevel: editGrade, note: editNote }), 'Student updated.');
  }
  return <section className="panel operations" aria-label="Students">
    <span className="eyebrow">STUDENTS</span><h2>{isAdmin ? 'Manage students' : 'Students in my classes'} ({data.learners.length})</h2>
    {isAdmin && <form className="ops-form" onSubmit={create}>
      <h3>Add a student</h3>
      <label>Name<input required maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>
      <label>Grade level<select value={grade} onChange={e => setGrade(e.target.value)}><option value="">Not set</option>{GRADE_LEVELS.map(g => <option key={g}>{g}</option>)}</select></label>
      <label>Note (max 120)<input maxLength={120} value={note} onChange={e => setNote(e.target.value)} /></label>
      <button className="primary-btn" type="submit" disabled={busy}>+ Add student</button>
    </form>}
    <label>Search students<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name" /></label>
    {shown.length === 0 ? <p className="quiet">{data.learners.length === 0 ? (isAdmin ? 'No students yet. Add the first one above.' : 'No students are in your classes yet.') : 'No students match your search.'}</p> :
      <div className="table-wrap"><table><thead><tr><th>Name</th><th>Grade</th><th>Status</th><th>Classes</th>{isAdmin && <th>Action</th>}</tr></thead><tbody>
        {shown.map(l => <tr key={l.id}><td>{l.display_name}</td><td>{l.grade_level ?? '—'}</td>
          <td><span className={'tag ' + (l.active ? 'green' : 'amber')}>{l.active ? 'Active' : 'Inactive'}</span></td><td>{classCount(l.id)}</td>
          {isAdmin && <td><button className="small-btn" onClick={() => startEdit(l)}>Edit</button></td>}</tr>)}
      </tbody></table></div>}
    {isAdmin && editing && <form className="ops-form" onSubmit={save}>
      <h3>Edit {editing.display_name}</h3>
      <label>Name<input required maxLength={80} value={editName} onChange={e => setEditName(e.target.value)} /></label>
      <label>Grade level<select value={editGrade} onChange={e => setEditGrade(e.target.value)}><option value="">Not set</option>{GRADE_LEVELS.map(g => <option key={g}>{g}</option>)}</select></label>
      <label>Note (max 120)<input maxLength={120} value={editNote} onChange={e => setEditNote(e.target.value)} /></label>
      <button className="primary-btn" type="submit" disabled={busy}>Save changes</button>
      <button className="small-btn" type="button" disabled={busy}
        onClick={() => void run(() => updateLearner(client, editing.id, { name: editName, gradeLevel: editGrade, note: editNote, active: !editing.active }),
          editing.active ? 'Student deactivated. No records were deleted.' : 'Student reactivated.')}>{editing.active ? 'Deactivate' : 'Reactivate'}</button>
      <button className="text-btn" type="button" onClick={() => setEditId('')}>Close</button>
    </form>}
    <p className="ops-feedback" role="status" aria-live="polite">{message}</p>
  </section>;
}

function Courses({ data, client, reload }: PanelProps) {
  const { message, busy, run } = useAction(reload);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  async function create(event: FormEvent) {
    event.preventDefault();
    if (await run(() => addCourse(client, { title, description }), 'Course added.')) { setTitle(''); setDescription(''); }
  }
  return <section className="panel operations" aria-label="Courses">
    <span className="eyebrow">COURSES</span><h2>Courses ({data.courses.length})</h2>
    <form className="ops-form" onSubmit={create}>
      <label>Course title<input required maxLength={80} value={title} onChange={e => setTitle(e.target.value)} /></label>
      <label>Description (optional)<input maxLength={300} value={description} onChange={e => setDescription(e.target.value)} /></label>
      <button className="primary-btn" type="submit" disabled={busy}>+ Add course</button>
    </form>
    {data.courses.length === 0 ? <p className="quiet">No courses yet. Add one to start creating classes.</p> :
      <div className="table-wrap"><table><thead><tr><th>Title</th><th>Description</th></tr></thead><tbody>
        {data.courses.map(c => <tr key={c.id}><td>{c.title}</td><td>{c.description ?? '—'}</td></tr>)}</tbody></table></div>}
    <p className="ops-feedback" role="status" aria-live="polite">{message}</p>
  </section>;
}

function Classes({ data, client, isAdmin, reload }: PanelProps & { isAdmin: boolean }) {
  const { message, busy, run } = useAction(reload);
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [openId, setOpenId] = useState('');
  const [learnerId, setLearnerId] = useState('');
  const course = (id: string) => data.courses.find(c => c.id === id)?.title ?? '—';
  const teacher = (id: string | null) => id ? (data.staff.find(s => s.id === id)?.display_name ?? 'Assigned teacher') : 'Unassigned';
  const teachers = data.staff.filter(s => s.role === 'teacher');
  const open = data.classes.find(c => c.id === openId);
  const roster = useMemo(() => data.enrollments.filter(e => e.class_id === openId)
    .map(e => data.learners.find(l => l.id === e.learner_id)).filter((l): l is Learner => Boolean(l)), [data, openId]);
  async function create(event: FormEvent) {
    event.preventDefault();
    if (await run(() => addClass(client, { title, courseId, teacherId }), 'Class created.')) { setTitle(''); setCourseId(''); setTeacherId(''); }
  }
  async function add(event: FormEvent) {
    event.preventDefault();
    const problem = enrollmentProblem({ learnerId, classId: openId, enrollments: data.enrollments, learners: data.learners });
    if (problem) return void run(async () => { throw Error(problem); }, '');
    await run(() => enroll(client, openId, learnerId), 'Student enrolled.');
  }
  return <section className="panel operations" aria-label="Classes">
    <span className="eyebrow">CLASSES</span><h2>{isAdmin ? 'Manage classes' : 'My classes'} ({data.classes.length})</h2>
    {isAdmin && <form className="ops-form" onSubmit={create}>
      <h3>Create a class</h3>
      <label>Class title<input required maxLength={80} value={title} onChange={e => setTitle(e.target.value)} /></label>
      <label>Course<select required value={courseId} onChange={e => setCourseId(e.target.value)}><option value="">Choose a course</option>
        {data.courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      <label>Teacher<select value={teacherId} onChange={e => setTeacherId(e.target.value)}><option value="">Unassigned</option>
        {teachers.map(t => <option key={t.id} value={t.id}>{t.display_name ?? 'Unnamed teacher'}</option>)}</select></label>
      {data.courses.length === 0 && <p className="quiet">Add a course first.</p>}
      <button className="primary-btn" type="submit" disabled={busy || !data.courses.length}>+ Create class</button>
    </form>}
    {data.classes.length === 0 ? <p className="quiet">{isAdmin ? 'No classes yet.' : 'You have no classes assigned yet.'}</p> :
      <div className="table-wrap"><table><thead><tr><th>Class</th><th>Course</th><th>Teacher</th><th>Students</th><th>Roster</th></tr></thead><tbody>
        {data.classes.map(c => <tr key={c.id}><td>{c.title}</td><td>{course(c.course_id)}</td><td>{isAdmin ? <select aria-label={'Teacher for ' + c.title} value={c.teacher_staff_id ?? ''} disabled={busy}
            onChange={e => void run(() => setClassTeacher(client, c.id, e.target.value), 'Teacher updated.')}><option value="">Unassigned</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.display_name ?? 'Unnamed teacher'}</option>)}</select> : teacher(c.teacher_staff_id)}</td>
          <td>{data.enrollments.filter(e => e.class_id === c.id).length}</td>
          <td><button className="small-btn" onClick={() => setOpenId(c.id === openId ? '' : c.id)}>{c.id === openId ? 'Hide' : 'View'}</button></td></tr>)}
      </tbody></table></div>}
    {open && <div className="people-enroll"><h3>Roster · {open.title}</h3>
      {roster.length === 0 ? <p className="quiet">No students enrolled yet.</p> :
        <ul>{roster.map(l => <li key={l.id}>{l.display_name}{isAdmin && <> <button className="text-btn" disabled={busy}
          onClick={() => void run(() => unenroll(client, open.id, l.id), 'Enrollment removed.')}>Remove</button></>}</li>)}</ul>}
      {isAdmin && <form className="ops-form" onSubmit={add}>
        <label>Enroll a student<select value={learnerId} onChange={e => setLearnerId(e.target.value)}><option value="">Choose a student</option>
          {data.learners.filter(l => l.active).map(l => <option key={l.id} value={l.id}>{l.display_name}</option>)}</select></label>
        <button className="primary-btn" type="submit" disabled={busy}>+ Enroll</button></form>}
    </div>}
    <p className="ops-feedback" role="status" aria-live="polite">{message}</p>
  </section>;
}

const STATUS_LABEL: Record<AttendanceStatus, string> = { present: 'Present', late: 'Late', absent: 'Absent', excused: 'Excused' };

function Attendance({ data, client, reload }: PanelProps) {
  const { message, busy, run } = useAction(reload);
  const [classId, setClassId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('16:00');
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const classSessions = data.sessions.filter(s => s.class_id === classId);
  const roster = data.enrollments.filter(e => e.class_id === classId)
    .map(e => data.learners.find(l => l.id === e.learner_id)).filter((l): l is Learner => Boolean(l));
  const saved = (learnerId: string) => data.attendance.find(a => a.session_id === sessionId && a.learner_id === learnerId)?.status;
  function chooseClass(id: string) { setClassId(id); setSessionId(''); setMarks({}); }
  function chooseSession(id: string) {
    setSessionId(id);
    const existing: Record<string, AttendanceStatus> = {};
    for (const a of data.attendance) if (a.session_id === id) existing[a.learner_id] = a.status;
    setMarks(existing);
  }
  async function createLesson(event: FormEvent) {
    event.preventDefault();
    if (duplicateSession(data.sessions, classId, date)) return void run(async () => { throw Error('This class already has a lesson on that date'); }, '');
    await run(() => addSession(client, classId, { date, time }), 'Lesson added. Select it below to take attendance.');
  }
  async function save() {
    const missing = roster.filter(l => !marks[l.id]).length;
    if (missing) return void run(async () => { throw Error('Mark every student (' + missing + ' left) before saving'); }, '');
    await run(() => saveAttendance(client, sessionId, marks), 'Attendance saved.');
  }
  const classRecords = data.attendance.filter(a => classSessions.some(s => s.id === a.session_id));
  const overall = attendanceSummary(classRecords);
  return <section className="panel operations" aria-label="Attendance">
    <span className="eyebrow">ATTENDANCE</span><h2>Take and review attendance</h2>
    {data.classes.length === 0 ? <p className="quiet">No classes available yet.</p> : <>
      <label>Class<select value={classId} onChange={e => chooseClass(e.target.value)}><option value="">Choose a class</option>
        {data.classes.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      {classId && <form className="ops-form" onSubmit={createLesson}>
        <h3>Add a lesson</h3>
        <label>Date<input type="date" required value={date} onChange={e => setDate(e.target.value)} /></label>
        <label>Time<input type="time" required value={time} onChange={e => setTime(e.target.value)} /></label>
        <button className="small-btn" type="submit" disabled={busy}>+ Add lesson</button>
      </form>}
      {classId && (classSessions.length === 0 ? <p className="quiet">No lessons yet for this class. Add one above.</p> :
        <label>Lesson<select value={sessionId} onChange={e => chooseSession(e.target.value)}><option value="">Choose a lesson</option>
          {classSessions.map(s => <option key={s.id} value={s.id}>{localDay(s.starts_at)} · {new Date(s.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</option>)}</select></label>)}
      {sessionId && (roster.length === 0 ? <p className="quiet">No students are enrolled in this class. Enroll students under Classes first.</p> :
        <div className="table-wrap"><table><thead><tr><th>Student</th><th>Status</th><th>Saved</th></tr></thead><tbody>
          {roster.map(l => <tr key={l.id}><td>{l.display_name}</td>
            <td><select aria-label={'Attendance for ' + l.display_name} value={marks[l.id] ?? ''} onChange={e => setMarks({ ...marks, [l.id]: e.target.value as AttendanceStatus })}>
              <option value="">Not marked</option>{ATTENDANCE_STATUSES.map((st: string) => <option key={st} value={st}>{STATUS_LABEL[st as AttendanceStatus]}</option>)}</select></td>
            <td>{saved(l.id) ? STATUS_LABEL[saved(l.id) as AttendanceStatus] : '—'}</td></tr>)}
        </tbody></table>
        <button className="primary-btn" type="button" disabled={busy} onClick={() => void save()}>Save attendance</button></div>)}
      {classId && <div className="people-enroll"><h3>Class summary</h3>
        {overall.marked + overall.excused === 0 ? <p className="quiet">No attendance recorded for this class yet.</p> :
          <p>Present {overall.present} · Late {overall.late} · Absent {overall.absent} · Excused {overall.excused}
            {overall.rate !== null && <> · Attendance rate <strong>{overall.rate}%</strong></>} <span className="quiet">(excused lessons are not counted)</span></p>}
      </div>}
    </>}
    <p className="ops-feedback" role="status" aria-live="polite">{message}</p>
  </section>;
}
