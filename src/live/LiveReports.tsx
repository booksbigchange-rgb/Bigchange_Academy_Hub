import { useState } from 'react';
import { lessonsByTeacher } from './dashboard.mjs';
import { formatDate, toCsv, todayIso } from './fees.mjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import LiveActivity from './LiveActivity';
import LiveMonthlyReport from './LiveMonthlyReport';
import type { Data } from './shared';

type Row = { teacherId: string | null; teacher: string; classes: number; held: number; complete: number; incomplete: number; upcoming: number; rate: number | null };
type Lesson = { sessionId: string; date: string; time: string; classTitle: string; teacher: string; held: boolean; marked: number; enrolled: number };
type Report = { rows: Row[]; lessons: Lesson[]; total: { held: number; complete: number; incomplete: number; upcoming: number } };

const monthName = (m: string) => new Date(m + '-15T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const shiftMonth = (m: string, n: number) => { const d = new Date(m + '-15T12:00:00'); d.setMonth(d.getMonth() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Admin reports: lessons per teacher per month, and the activity log. */
export default function LiveReports({ data, client }: { data: Data; client: SupabaseClient }) {
  const [tab, setTab] = useState<'lessons' | 'monthly' | 'activity'>('lessons');
  return <section className="panel operations" aria-label="Reports">
    <span className="eyebrow">REPORTS</span><h2>{tab === 'lessons' ? 'Lessons per teacher' : tab === 'monthly' ? 'Monthly report' : 'Activity log'}</h2>
    <div className="report-tabs no-print" role="group" aria-label="Choose a report">
      <button type="button" className={'small-btn' + (tab === 'lessons' ? ' report-tab-on' : '')} aria-pressed={tab === 'lessons'} onClick={() => setTab('lessons')}>Lessons per teacher</button>
      <button type="button" className={'small-btn' + (tab === 'monthly' ? ' report-tab-on' : '')} aria-pressed={tab === 'monthly'} onClick={() => setTab('monthly')}>Monthly report</button>
      <button type="button" className={'small-btn' + (tab === 'activity' ? ' report-tab-on' : '')} aria-pressed={tab === 'activity'} onClick={() => setTab('activity')}>Activity log</button>
    </div>
    {tab === 'lessons' ? <LessonsReport data={data} /> : tab === 'monthly' ? <LiveMonthlyReport data={data} /> : <LiveActivity client={client} data={data} />}
  </section>;
}

/** Lessons per teacher per month (for paying teachers and spotting missing attendance). */
function LessonsReport({ data }: { data: Data }) {
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const r: Report = lessonsByTeacher(data, month);
  const max = Math.max(1, ...r.rows.map(x => x.held + x.upcoming));
  function downloadSummary() {
    download(`bigchange-lessons-per-teacher-${month}.csv`, toCsv(['Month', 'Teacher', 'Classes', 'Lessons held', 'Fully marked', 'Not fully marked', 'Still to come', 'Attendance %'],
      r.rows.map(x => [month, x.teacher, x.classes, x.held, x.complete, x.incomplete, x.upcoming, x.rate ?? ''])));
  }
  function downloadLessons() {
    download(`bigchange-lessons-${month}.csv`, toCsv(['Date', 'Time', 'Class', 'Teacher', 'Held', 'Marked', 'Enrolled'],
      r.lessons.map(l => [l.date, l.time, l.classTitle, l.teacher, l.held ? 'yes' : 'not yet', l.marked, l.enrolled])));
  }
  return <div>
    <p className="quiet">Lessons added on the Attendance screen, counted for each class's current teacher. "Not fully marked" means fewer students were marked than are enrolled in the class now. Use it to pay teachers and to see where attendance is missing.</p>
    <div className="report-month">
      <button className="small-btn" type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">‹ Previous</button>
      <label>Month<input type="month" value={month} onChange={e => e.target.value && setMonth(e.target.value)} /></label>
      <button className="small-btn" type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">Next ›</button>
    </div>

    <div className="metric-grid">
      <div className="metric metric-hero"><div className="metric-value">{r.total.held}</div><div className="metric-title">Lessons held</div><div className="metric-subtitle">{monthName(month)}</div></div>
      <div className="metric"><div className="metric-value">{r.total.complete}</div><div className="metric-title">Fully marked</div><div className="metric-subtitle">every enrolled student has a mark</div></div>
      <div className="metric"><div className="metric-value">{r.total.incomplete}</div><div className="metric-title">Not fully marked</div><div className="metric-subtitle">{r.total.incomplete ? 'ask the teacher to finish' : 'nothing missing'}</div></div>
      <div className="metric"><div className="metric-value">{r.total.upcoming}</div><div className="metric-title">Still to come</div><div className="metric-subtitle">planned later this month</div></div>
    </div>

    {r.rows.length === 0 ? <p className="quiet">No lessons in {monthName(month)}. Teachers add lessons on the Attendance screen.</p> : <>
      <div className="dash-grid">
        <section className="dash-card" aria-label="Lessons per teacher chart">
          <h3>Lessons in {monthName(month)}</h3>
          <div className="dash-bars" role="img" aria-label={'Bar chart of lessons per teacher: ' + r.rows.map(x => `${x.teacher} ${x.held} held${x.upcoming ? `, ${x.upcoming} to come` : ''}`).join('; ')}>
            {r.rows.map(x => <div className="dash-bar-row" key={x.teacherId ?? 'none'} title={`${x.teacher}: ${x.held} held, ${x.incomplete} not fully marked, ${x.upcoming} to come`}>
              <span className="dash-bar-label">{x.teacher}</span>
              <span className="dash-bar-track report-stack">
                <span className="report-seg report-seg-ok" style={{ width: (x.complete / max) * 100 + '%' }} />
                <span className="report-seg report-seg-missing" style={{ width: (x.incomplete / max) * 100 + '%' }} />
                <span className="report-seg report-seg-upcoming" style={{ width: (x.upcoming / max) * 100 + '%' }} />
              </span>
              <strong>{x.held}</strong></div>)}
          </div>
          <div className="dash-heat-key" aria-hidden="true"><span className="dash-swatch report-seg-ok" />Fully marked <span className="dash-swatch report-seg-missing" />Not fully marked <span className="dash-swatch report-seg-upcoming" />Still to come</div>
        </section>
      </div>

      <div className="table-wrap" tabIndex={0} role="region" aria-label="Lessons per teacher table"><table><thead><tr><th>Teacher</th><th>Classes</th><th>Lessons held</th><th>Fully marked</th><th>Not fully marked</th><th>Still to come</th><th>Attendance</th></tr></thead><tbody>
        {r.rows.map(x => <tr key={x.teacherId ?? 'none'}><td>{x.teacher}</td><td>{x.classes}</td><td><strong>{x.held}</strong></td><td>{x.complete}</td>
          <td>{x.incomplete ? <span className="tag amber">{x.incomplete}</span> : 0}</td><td>{x.upcoming}</td><td>{x.rate === null ? '—' : x.rate + '%'}</td></tr>)}
        <tr className="report-total"><td>Total</td><td></td><td><strong>{r.total.held}</strong></td><td>{r.total.complete}</td><td>{r.total.incomplete}</td><td>{r.total.upcoming}</td><td></td></tr>
      </tbody></table></div>

      {r.lessons.some(l => l.held && l.enrolled > 0 && l.marked < l.enrolled) && <div className="people-enroll" aria-label="Lessons not fully marked">
        <h3>Lessons not fully marked</h3>
        <ul className="dash-list">{r.lessons.filter(l => l.held && l.enrolled > 0 && l.marked < l.enrolled).map(l => <li key={l.sessionId}>
          <span>{formatDate(l.date)} {l.time} · {l.classTitle} · {l.teacher}</span><span className="tag amber">{l.marked} of {l.enrolled} marked</span></li>)}</ul>
      </div>}

      <p className="report-downloads">
        <button className="small-btn" type="button" onClick={downloadSummary}>Download summary (CSV)</button>
        <button className="small-btn" type="button" onClick={downloadLessons}>Download every lesson (CSV)</button>
        <span className="quiet">Opens in Google Sheets or Excel.</span>
      </p>
    </>}
  </div>;
}
