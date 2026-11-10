import { useState } from 'react';
import { addDays, formatDate, levelEndNotice, nextLevelName, shareToWhatsApp, todayIso } from './fees.mjs';
import type { Data } from './shared';

/**
 * Teachers write a notice for a class and share it to the class WhatsApp group (or copy it). Nothing is sent by the app:
 * WhatsApp opens and asks which chat or group to send to. Free.
 */
export default function LiveNotices({ data, initialClassId = '' }: { data: Data; initialClassId?: string }) {
  const initial = data.classes.find(c => c.id === initialClassId);
  const [classId, setClassId] = useState(initial ? initial.id : '');
  const [kind, setKind] = useState<'end' | 'general'>('end');
  const [endDate, setEndDate] = useState(initial?.level_end ?? todayIso());
  const [nextStart, setNextStart] = useState(addDays(initial?.level_end ?? todayIso(), 8));
  const [nextLevel, setNextLevel] = useState(initial ? nextLevelName(initial.title) : '');
  const [general, setGeneral] = useState('');
  const [note, setNote] = useState('');
  const cls = data.classes.find(c => c.id === classId);
  function chooseClass(id: string) {
    setClassId(id); setNote('');
    const c = data.classes.find(x => x.id === id);
    setNextLevel(nextLevelName(c?.title ?? ''));
    if (c?.level_end) chooseEnd(c.level_end);
  }
  function chooseEnd(value: string) { setEndDate(value); if (/^\d{4}-\d{2}-\d{2}$/.test(value)) setNextStart(addDays(value, 8)); }
  const text = !cls ? '' : kind === 'end'
    ? levelEndNotice({ classTitle: cls.title, endDate, nextStart, nextLevel: nextLevel.trim() })
    : general.trim() ? `Dear parents of ${cls.title}, ${general.trim()} Thank you, BigChange Academy.` : '';
  const problem = kind === 'end' && nextStart <= endDate ? 'The next level must start after the end date.' : '';
  async function copy() {
    try { await navigator.clipboard.writeText(text); setNote('Notice copied. Paste it into the class WhatsApp group.'); }
    catch { setNote('Copying was blocked by the browser.'); }
  }
  return <section className="panel operations" aria-label="Notices">
    <span className="eyebrow">NOTICES TO PARENTS</span><h2>Write a notice for a class</h2>
    <p className="quiet">The app writes the message; WhatsApp opens and you choose the class group. Nothing is sent by the app, and it is free.</p>
    {data.classes.length === 0 ? <p className="quiet">You have no classes yet.</p> : <>
      <label>Class<select value={classId} onChange={e => chooseClass(e.target.value)}><option value="">Choose a class</option>
        {data.classes.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      <label>Notice<select value={kind} onChange={e => setKind(e.target.value as 'end' | 'general')}>
        <option value="end">End of level (with the one-week break)</option><option value="general">Other notice</option></select></label>
      {kind === 'end' ? <>
        <label>Last day of this level<input type="date" value={endDate} onChange={e => chooseEnd(e.target.value)} /></label>
        <label>Next level starts on (after a one-week break)<input type="date" value={nextStart} onChange={e => setNextStart(e.target.value)} /></label>
        <label>Next level (optional)<input maxLength={80} value={nextLevel} onChange={e => setNextLevel(e.target.value)} placeholder="e.g. English – Level 3" /></label>
      </> : <label>Message<textarea rows={3} maxLength={600} value={general} onChange={e => setGeneral(e.target.value)} placeholder="e.g. Tomorrow's class is moved to 5 pm. The Zoom link stays the same." /></label>}
      {cls && text && <div className="people-enroll" aria-label="Notice preview">
        <h3>Preview</h3><p>{text}</p>
        {problem ? <p className="ops-feedback" role="alert">{problem}</p> : <>
          <a className="primary-btn" href={shareToWhatsApp(text)} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>{' '}
          <button className="small-btn" type="button" onClick={() => void copy()}>Copy</button></>}
        {kind === 'end' && !problem && <p className="quiet">Break: {formatDate(addDays(endDate, 1))} – {formatDate(addDays(nextStart, -1))}.</p>}
      </div>}
    </>}
    <p className="ops-feedback" role="status" aria-live="polite">{note}</p>
  </section>;
}
