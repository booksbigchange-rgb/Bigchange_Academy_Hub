import { overviewCounts } from './validation.mjs';
import { endingText, formatDate, levelsEndingSoon, periodsToStart, todayIso } from './fees.mjs';
import { attendanceCalendar, attendanceRecent, donutSlices, heatStep, paymentStatusCounts, studentsPerCourse, weeklyAttendance } from './dashboard.mjs';
import type { Data, Role } from './shared';

type Card = { title: string; value: string | number; note: string; progress?: number };
type NextRow = { learnerId: string; name: string; reason: 'ended' | 'soon' | 'never'; days: number };
type Slice = { dash: number; offset: number; value: number };

const STATUS = [
  { key: 'paid', label: 'Paid', color: '#0ca30c' },
  { key: 'partial', label: 'Partly paid', color: '#fab219' },
  { key: 'unpaid', label: 'Unpaid', color: '#ec835a' },
  { key: 'overdue', label: 'Overdue', color: '#d03b3b' },
] as const;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const shortDate = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export default function LiveOverview({ data, role, go, onWriteNotice }: { data: Data; role: Role; go: (section: string) => void; onWriteNotice?: (classId: string) => void }) {
  const today = todayIso();
  const isAdmin = role === 'admin';
  const seesPayments = isAdmin || role === 'finance';
  const seesAttendance = isAdmin || role === 'teacher';
  const ending = isAdmin || role === 'teacher' ? levelsEndingSoon(data.classes) : [];
  const noDates = data.classes.filter(c => !c.level_end).length;
  const c = overviewCounts(data);
  const pay = paymentStatusCounts(data.periods, today);
  const recent = attendanceRecent(data, today);
  const change = recent.rate !== null && recent.before !== null ? recent.rate - recent.before : null;
  const nextUp: NextRow[] = seesPayments ? periodsToStart(data, today) : [];

  const cards: Card[] = isAdmin ? [
    { title: 'Active students', value: c.activeStudents, note: c.inactiveStudents ? c.inactiveStudents + ' inactive' : 'No inactive students' },
    { title: 'Classes', value: c.classes, note: c.unassignedClasses ? c.unassignedClasses + ' without a teacher' : ending.length ? ending.length + ' level' + (ending.length === 1 ? '' : 's') + ' ending soon' : 'All have a teacher' },
    { title: 'Paid (current periods)', value: pay.paid, note: pay.total ? `of ${pay.total} · ${pay.overdue} overdue · ${c.awaitingApproval} to approve` : 'No payment periods yet', progress: pay.total ? pay.paid / pay.total : undefined },
    { title: 'Attendance (4 weeks)', value: recent.rate === null ? '—' : recent.rate + '%', note: change === null ? (recent.rate === null ? 'No attendance recorded yet' : 'Compared with the 4 weeks before') : (change >= 0 ? '▲ ' : '▼ ') + Math.abs(change) + ' points on the 4 weeks before' }]
    : role === 'finance' ? [
    { title: 'Awaiting check', value: c.awaitingCheck, note: 'Reported by teachers' },
    { title: 'Overdue', value: c.overdue, note: 'Not approved as paid after the period' },
    { title: 'Awaiting approval', value: c.awaitingApproval, note: 'Checked, waiting for an administrator' },
    { title: 'Next 3 months to start', value: nextUp.length, note: 'Children whose period ended or ends soon' }]
    : [
    { title: 'My classes', value: c.classes, note: c.emptyClasses ? c.emptyClasses + ' with no students' : 'All have students' },
    { title: 'My students', value: c.activeStudents, note: 'Active students in my classes' },
    { title: 'Parents overdue', value: c.overdue, note: 'Payments overdue for my students’ parents' },
    { title: 'Attendance (4 weeks)', value: recent.rate === null ? '—' : recent.rate + '%', note: 'In my classes' }];
  const next: Array<[string, string]> = isAdmin
    ? [['Students', 'Add or import students'], ['Classes', 'Create a class or change its teacher'], ['Fees', 'Approve payments'], ['Guardians', c.pendingLinks ? `Verify parents (${c.pendingLinks})` : 'Parents']]
    : role === 'finance' ? [['Fees', 'Check reported payments'], ['Guardians', 'Parent contacts']]
    : [['Attendance', 'Take attendance'], ['Fees', 'Report a parent payment'], ['Guardians', 'Add a parent contact']];

  return <section className="panel dash" aria-label="Overview">
    <span className="eyebrow">OVERVIEW</span><h2>Welcome back</h2>
    <div className="metric-grid">{cards.map((card, i) => <div className={i === 0 ? 'metric metric-hero' : 'metric'} key={card.title}>
      <div className="metric-value">{card.value}</div><div className="metric-title">{card.title}</div>
      {card.progress !== undefined && <div className="dash-progress" aria-hidden="true"><span style={{ width: Math.round(card.progress * 100) + '%' }} /></div>}
      <div className="metric-subtitle">{card.note}</div></div>)}</div>
    {data.learners.length === 0 && data.classes.length === 0 && <p className="quiet">Nothing has been added yet. {isAdmin ? 'Start with a course, then a student and a class.' : 'Ask an administrator to add classes and students.'}</p>}

    <div className="dash-grid">
      {seesPayments && <PaymentsDonut pay={pay} />}
      {role !== 'finance' && <CourseBars data={data} />}
      {seesAttendance && <WeeklyLine data={data} today={today} />}
    </div>

    {seesAttendance && <HeatCalendar data={data} today={today} />}

    <div className="dash-lists">
      {seesPayments && <div className="people-enroll" aria-label="Next 3 months to start">
        <h3>Next 3 months to start ({nextUp.length})</h3>
        {nextUp.length === 0 ? <p className="quiet">Every enrolled child has a current period.</p> :
          <ul className="dash-list">{nextUp.slice(0, 5).map(r => <li key={r.learnerId}><span>{r.name}</span>
            <span className={'tag ' + (r.reason === 'ended' ? 'red' : 'amber')}>{r.reason === 'never' ? 'Not started' : r.reason === 'soon' ? `Ends in ${r.days} day${r.days === 1 ? '' : 's'}` : r.days === 0 ? 'Ended today' : `Ended ${-r.days} day${r.days === -1 ? '' : 's'} ago`}</span></li>)}</ul>}
        {nextUp.length > 0 && <button className="small-btn" type="button" onClick={() => go('Fees')}>{nextUp.length > 5 ? `See all ${nextUp.length} in Fees` : 'Start them in Fees'}</button>}
      </div>}
      {(isAdmin || role === 'teacher') && <div className="people-enroll" aria-label="Levels ending soon">
        <h3>Levels ending soon ({ending.length})</h3>
        {ending.length === 0 ? <p className="quiet">No level ends in the next 14 days.{noDates > 0 && ` ${noDates} class${noDates === 1 ? ' has' : 'es have'} no level dates yet — set them under Classes → View.`}</p> :
          <ul>{ending.map(c => <li key={c.id}><strong>{c.title}</strong> — {endingText(c.daysLeft)} ({formatDate(c.level_end ?? '')}){' '}
            <button className="small-btn" type="button" onClick={() => onWriteNotice?.(c.id)}>Write notice to parents</button></li>)}</ul>}
        {ending.length > 0 && <p className="quiet">After the one-week break, move the class to its next level under Classes → View.</p>}
      </div>}
    </div>
    <div className="quick-actions">{next.map(([section, text]) => <button key={section} className="small-btn" onClick={() => go(section)}>{text}</button>)}</div>
  </section>;
}

export function PaymentsDonut({ pay }: { pay: ReturnType<typeof paymentStatusCounts> }) {
  const C = 2 * Math.PI * 70;
  const slices: Slice[] = donutSlices(STATUS.map(s => pay[s.key]), C);
  const label = `Donut chart of current payment periods: ${STATUS.map(s => `${pay[s.key]} ${s.label.toLowerCase()}`).join(', ')}, of ${pay.total}`;
  return <section className="dash-card" aria-label="Payments this term">
    <h3>Payments (current periods)</h3>
    {pay.total === 0 ? <p className="quiet">No payment periods have started yet.</p> : <div className="dash-donut">
      <svg width="170" height="170" viewBox="0 0 170 170" role="img" aria-label={label}>
        <circle cx="85" cy="85" r="70" fill="none" stroke="#efeae1" strokeWidth="26" />
        <g transform="rotate(-90 85 85)" fill="none" strokeWidth="26">
          {slices.map((s, i) => s.value > 0 && <circle key={STATUS[i].key} cx="85" cy="85" r="70" stroke={STATUS[i].color}
            strokeDasharray={`${s.dash} ${C}`} strokeDashoffset={s.offset}><title>{STATUS[i].label}: {s.value}</title></circle>)}
        </g>
        <text x="85" y="84" textAnchor="middle" fontSize="28" fontWeight="700" fill="#1f1b16">{pay.total}</text>
        <text x="85" y="104" textAnchor="middle" fontSize="12" fill="#6b6257">periods</text>
      </svg>
      <ul className="dash-legend">{STATUS.map(s => <li key={s.key}><span className="dash-swatch" style={{ background: s.color }} />{s.label} <strong>{pay[s.key]}</strong></li>)}</ul>
    </div>}
  </section>;
}

export function CourseBars({ data }: { data: Data }) {
  const rows = studentsPerCourse(data);
  const max = Math.max(1, ...rows.map(r => r.count));
  return <section className="dash-card" aria-label="Students per course">
    <h3>Students per course</h3>
    {rows.length === 0 ? <p className="quiet">No students are enrolled in a class yet.</p> :
      <div className="dash-bars">{rows.map(r => <div className="dash-bar-row" key={r.label} title={`${r.label}: ${r.count}`}>
        <span className="dash-bar-label">{r.label}</span>
        <span className="dash-bar-track"><span className="dash-bar" style={{ width: Math.max(4, (r.count / max) * 100) + '%' }} /></span>
        <strong>{r.count}</strong></div>)}</div>}
  </section>;
}

function WeeklyLine({ data, today }: { data: Data; today: string }) {
  const weeks = weeklyAttendance(data, today, 8);
  const known = weeks.filter(w => w.rate !== null) as Array<{ weekStart: string; rate: number; marked: number }>;
  const low = Math.min(50, ...known.map(w => Math.floor(w.rate / 10) * 10));
  const x = (i: number) => 44 + i * (280 / (weeks.length - 1));
  const y = (r: number) => 140 - ((r - low) / (100 - low)) * 120;
  let path = ''; let pen = false;
  weeks.forEach((w, i) => { if (w.rate === null) { pen = false; return; } path += (pen ? ' L' : ' M') + x(i).toFixed(1) + ' ' + y(w.rate).toFixed(1); pen = true; });
  const lastIdx = weeks.map(w => w.rate !== null).lastIndexOf(true);
  const label = 'Line chart of attendance per week: ' + weeks.map(w => `week of ${shortDate(w.weekStart)} ${w.rate === null ? 'no lessons' : w.rate + '%'}`).join(', ');
  return <section className="dash-card" aria-label="Attendance by week">
    <h3>Attendance by week</h3>
    {known.length === 0 ? <p className="quiet">No attendance recorded in the last 8 weeks.</p> :
      <svg width="100%" viewBox="0 0 340 170" role="img" aria-label={label}>
        <line x1="44" y1="20" x2="324" y2="20" stroke="#efeae1" /><line x1="44" y1="80" x2="324" y2="80" stroke="#efeae1" />
        <line x1="44" y1="140" x2="324" y2="140" stroke="#d9d2c5" />
        <text x="38" y="24" textAnchor="end" fontSize="10" fill="#6b6257">100%</text>
        <text x="38" y="144" textAnchor="end" fontSize="10" fill="#6b6257">{low}%</text>
        <path d={path} fill="none" stroke="#2a78d6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {weeks.map((w, i) => w.rate !== null && <circle key={w.weekStart} cx={x(i)} cy={y(w.rate)} r={i === lastIdx ? 5 : 4} fill="#2a78d6" stroke="#ffffff" strokeWidth="2">
          <title>Week of {shortDate(w.weekStart)}: {w.rate}% ({w.marked} marks)</title></circle>)}
        {lastIdx >= 0 && <text x={x(lastIdx) - 8} y={y(weeks[lastIdx].rate as number) - 10} textAnchor="end" fontSize="12" fontWeight="700" fill="#1f1b16">{weeks[lastIdx].rate}%</text>}
        <text x="44" y="160" fontSize="11" fill="#6b6257">{shortDate(weeks[0].weekStart)}</text>
        <text x="324" y="160" textAnchor="end" fontSize="11" fill="#6b6257">This week</text>
      </svg>}
  </section>;
}

export function HeatCalendar({ data, today, title = 'Attendance, last 4 weeks', note = 'Each square is a day; darker blue means more students were present. Empty squares had no lesson.' }: { data: Data; today: string; title?: string; note?: string }) {
  const cal = attendanceCalendar(data, today, 4);
  const any = cal.some(w => w.some(d => d.rate !== null));
  return <section className="dash-card dash-heat-card" aria-label="Attendance calendar">
    <h3>{title}</h3>
    <p className="quiet">{note}</p>
    {!any ? <p className="quiet">No attendance recorded in the last 4 weeks.</p> : <>
      <div className="dash-heat" role="table" aria-label="Attendance per day, last 4 weeks">
        <div role="row" className="dash-heat-row"><span role="columnheader" className="dash-heat-week">Week of</span>{DAYS.map(d => <span role="columnheader" key={d} className="dash-heat-day">{d}</span>)}</div>
        {cal.map(week => <div role="row" className="dash-heat-row" key={week[0].date}>
          <span role="rowheader" className="dash-heat-week">{shortDate(week[0].date)}</span>
          {week.map(d => <span role="cell" key={d.date} aria-label={d.rate === null ? undefined : `${d.rate}% present`} className={'dash-heat-cell heat-' + (d.future ? 'f' : heatStep(d.rate))}
            title={d.future ? '' : d.rate === null ? `${shortDate(d.date)}: no lesson` : `${shortDate(d.date)}: ${d.rate}% present (${d.marked} marks)`}>
            {d.rate === null ? <span className="sr-only">{d.future ? 'Not yet' : 'No lesson'}</span> : <>{d.rate}<span className="heat-pct">%</span></>}</span>)}
        </div>)}
      </div>
      <div className="dash-heat-key" aria-hidden="true"><span>Fewer present</span>{[1, 2, 3, 4, 5].map(s => <span key={s} className={'dash-heat-swatch heat-' + s} />)}<span>More present</span></div>
    </>}
  </section>;
}
