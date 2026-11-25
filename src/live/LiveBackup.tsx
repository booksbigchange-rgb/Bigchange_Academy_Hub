import { useState } from 'react';
import { backupZip } from './backup.mjs';
import { formatDate } from './fees.mjs';
import type { Data } from './shared';

const KEY = 'bigchange-last-backup';
const readLast = () => { try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; } };

/** Admin: download all the Academy's data as one ZIP of spreadsheet files (a copy you keep yourself). */
export default function LiveBackup({ data }: { data: Data }) {
  const [last, setLast] = useState(readLast());
  const [note, setNote] = useState('');
  const counts: Array<[string, number]> = [['Students', data.learners.length], ['Parents', data.guardians.length], ['Classes', data.classes.length],
    ['Lessons', data.sessions.length], ['Attendance marks', data.attendance.length], ['Payment periods', data.periods.length], ['Staff', data.staff.length]];
  function download() {
    const { name, bytes } = backupZip(data);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    const today = new Date().toISOString().slice(0, 10);
    try { localStorage.setItem(KEY, today); } catch { /* private window: nothing to remember */ }
    setLast(today);
    setNote(`Downloaded ${name}. Keep it somewhere private, for example the school's Google Drive.`);
  }
  return <div>
    <p className="quiet">One ZIP file with a spreadsheet (CSV) for each kind of data: students, parents, classes, enrollments, lessons, attendance, payment periods, reminders, payment methods and staff, plus a read-me. It opens in Google Sheets or Excel. Make one every week and keep the last few.</p>
    <div className="metric-grid">{counts.slice(0, 4).map(([label, n], i) => <div key={label} className={i === 0 ? 'metric metric-hero' : 'metric'}>
      <div className="metric-value">{n}</div><div className="metric-title">{label}</div></div>)}</div>
    <p className="quiet">Also included: {counts.slice(4).map(([l, n]) => `${n} ${l.toLowerCase()}`).join(', ')}.</p>
    <p className="report-downloads">
      <button className="primary-btn" type="button" onClick={download}>Download backup (ZIP)</button>
      <span className="quiet">{last ? `Last downloaded on this computer: ${formatDate(last)}` : 'Not downloaded on this computer yet.'}</span>
    </p>
    {note && <p role="status">{note}</p>}
    <div className="people-enroll">
      <h3>Keep it safe</h3>
      <ul>
        <li>The file contains parents' names, phone numbers and emails. Store it on a school computer or the school's Google Drive, never on a personal phone.</li>
        <li>Login accounts and passwords are not in it; they stay in Supabase. The activity log is not in it either.</li>
        <li>This is an extra copy you control. For a full database copy, also follow docs/BACKUPS.md.</li>
      </ul>
    </div>
  </div>;
}
