import { useState } from 'react';
import { monthlyReport } from './dashboard.mjs';
import { formatDate, todayIso, usd } from './fees.mjs';
import { CourseBars, PaymentsDonut } from './LiveOverview';
import type { Data } from './shared';

type Report = {
  month: string; asOf: string;
  students: { active: number };
  payments: { started: number; startedFees: number; reported: number; reportedAmount: number; reportedWithAmount: number; approved: number;
    status: { paid: number; partial: number; unpaid: number; overdue: number; total: number }; notPaid: number; notPaidFees: number };
  attendance: { rate: number | null; perClass: Array<{ id: string; title: string; lessons: number; rate: number | null }> };
  lessons: { rows: Array<{ teacherId: string | null; teacher: string; classes: number; held: number; incomplete: number; rate: number | null }>; total: { held: number; incomplete: number } };
  levelsEnding: Array<{ id: string; title: string; levelEnd: string }>;
};
const monthName = (m: string) => new Date(m + '-15T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const shiftMonth = (m: string, n: number) => { const d = new Date(m + '-15T12:00:00'); d.setMonth(d.getMonth() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };

/** One-page summary of a month for management. "Print or save as PDF" prints only this report. */
export default function LiveMonthlyReport({ data }: { data: Data }) {
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const r: Report = monthlyReport(data, month);
  const p = r.payments;
  return <div>
    <div className="report-month no-print">
      <button className="small-btn" type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">‹ Previous</button>
      <label>Month<input type="month" value={month} onChange={e => e.target.value && setMonth(e.target.value)} /></label>
      <button className="small-btn" type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">Next ›</button>
      <button className="primary-btn" type="button" onClick={() => window.print()}>Print or save as PDF</button>
    </div>

    <article className="monthly-report" aria-label={'Monthly report ' + monthName(month)}>
      <header className="monthly-head">
        <div><div className="monthly-brand">BIG CHANGE ACADEMY</div><h3>Monthly report · {monthName(month)}</h3></div>
        <div className="monthly-meta">Prepared {formatDate(todayIso())}<br />Payment status as of {formatDate(r.asOf)}</div>
      </header>

      <div className="metric-grid">
        <div className="metric metric-hero"><div className="metric-value">{r.students.active}</div><div className="metric-title">Active students</div><div className="metric-subtitle">enrolled at the Academy now</div></div>
        <div className="metric"><div className="metric-value">{r.lessons.total.held}</div><div className="metric-title">Lessons held</div><div className="metric-subtitle">{r.lessons.total.incomplete ? `${r.lessons.total.incomplete} not fully marked` : 'all fully marked'}</div></div>
        <div className="metric"><div className="metric-value">{r.attendance.rate === null ? '—' : r.attendance.rate + '%'}</div><div className="metric-title">Attendance</div><div className="metric-subtitle">present or late, excused not counted</div></div>
        <div className="metric"><div className="metric-value">{usd(p.notPaidFees)}</div><div className="metric-title">Not yet paid</div><div className="metric-subtitle">{p.notPaid} current period{p.notPaid === 1 ? '' : 's'} not approved as paid</div></div>
      </div>

      <div className="dash-grid">
        <PaymentsDonut pay={p.status} />
        <section className="dash-card" aria-label="Payments this month">
          <h3>Payments this month</h3>
          <table className="monthly-table"><tbody>
            <tr><th scope="row">3-month periods started</th><td>{p.started}</td><td>{usd(p.startedFees)} in fees</td></tr>
            <tr><th scope="row">Payments reported (paid in this month)</th><td>{p.reported}</td><td>{p.approved} approved</td></tr>
            <tr><th scope="row">Amounts entered with those reports</th><td>{usd(p.reportedAmount)}</td><td>{p.reportedWithAmount} of {p.reported} reports have an amount</td></tr>
            <tr><th scope="row">Not yet approved as paid</th><td>{p.notPaid}</td><td>{usd(p.notPaidFees)} in fees</td></tr>
          </tbody></table>
          <p className="quiet">The amount paid is optional on a report, so totals only include reports where staff entered it.</p>
        </section>
        <CourseBars data={data} />
      </div>

      <div className="dash-grid">
        <section className="dash-card" aria-label="Attendance per class">
          <h3>Attendance per class</h3>
          {r.attendance.perClass.length === 0 ? <p className="quiet">No lessons in {monthName(month)}.</p> :
            <table className="monthly-table"><thead><tr><th>Class</th><th>Lessons</th><th>Attendance</th></tr></thead><tbody>
              {r.attendance.perClass.map(c => <tr key={c.id}><td>{c.title}</td><td>{c.lessons}</td><td>{c.rate === null ? '—' : c.rate + '%'}</td></tr>)}
            </tbody></table>}
        </section>
        <section className="dash-card" aria-label="Lessons per teacher this month">
          <h3>Lessons per teacher</h3>
          {r.lessons.rows.length === 0 ? <p className="quiet">No lessons in {monthName(month)}.</p> :
            <table className="monthly-table"><thead><tr><th>Teacher</th><th>Held</th><th>Not fully marked</th><th>Attendance</th></tr></thead><tbody>
              {r.lessons.rows.map(t => <tr key={t.teacherId ?? 'none'}><td>{t.teacher}</td><td>{t.held}</td><td>{t.incomplete}</td><td>{t.rate === null ? '—' : t.rate + '%'}</td></tr>)}
            </tbody></table>}
        </section>
        <section className="dash-card" aria-label="Levels ending next month">
          <h3>Levels ending next month</h3>
          {r.levelsEnding.length === 0 ? <p className="quiet">No level ends in {monthName(shiftMonth(month, 1))}.</p> :
            <ul className="dash-list">{r.levelsEnding.map(c => <li key={c.id}><span>{c.title}</span><span>{formatDate(c.levelEnd)}</span></li>)}</ul>}
        </section>
      </div>
      <p className="quiet monthly-foot">Made with the BigChange Academy Hub from the data recorded by staff. Internal: contains no parent contact details.</p>
    </article>
  </div>;
}
