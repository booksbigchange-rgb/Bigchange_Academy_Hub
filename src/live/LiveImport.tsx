import { useState, type ChangeEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { addGuardian, addLearner, enroll } from './api';
import { planImport, parseCsv, TEMPLATE_EXAMPLE, TEMPLATE_HEADER } from './importCsv.mjs';
import { toCsv } from './fees.mjs';
import type { Data } from './shared';

type Item = { line: number; name: string; grade: string; className: string; classId: string; status: 'ready' | 'skip' | 'problem'; problem: string;
  parent: { name: string; phone: string; email: string; emailOptIn: boolean; whatsappOptIn: boolean } };
type Plan = { error?: string; unknown?: string[]; items?: Item[] };
type Done = { line: number; name: string; result: string; ok: boolean };
const MAX_BYTES = 1_000_000;

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const err = (e: unknown) => (e instanceof Error ? e.message : 'unknown error');

/** Admin: add many students and their parents from a CSV file, with a preview first. Uses the same database calls as the form. */
export default function LiveImport({ data, client, reload }: { data: Data; client: SupabaseClient; reload: () => Promise<void> }) {
  const [fileName, setFileName] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [done, setDone] = useState<Done[]>([]);
  const plan: Plan | null = text ? planImport(parseCsv(text), data) as Plan : null;
  const items: Item[] = plan?.items ?? [];
  const ready = items.filter(i => i.status === 'ready');
  const count = (s: string) => items.filter(i => i.status === s).length;

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setDone([]); setProgress('');
    if (!file) { setText(''); setFileName(''); return; }
    if (file.size > MAX_BYTES) { setText(''); setFileName(''); setProgress('That file is too big (over 1 MB). Split it into smaller files.'); return; }
    setFileName(file.name); setText(await file.text());
  }
  async function runImport() {
    if (busy || !ready.length) return;
    setBusy(true); setDone([]);
    const results: Done[] = [];
    for (const [n, item] of ready.entries()) {
      setProgress(`Importing ${n + 1} of ${ready.length}…`);
      let id = '';
      try { id = await addLearner(client, { name: item.name, gradeLevel: item.grade }); }
      catch (e) { results.push({ line: item.line, name: item.name, ok: false, result: 'Not added: ' + err(e) }); continue; }
      const notes: string[] = [];
      try { await addGuardian(client, id, item.parent); } catch (e) { notes.push('parent not saved (' + err(e) + '), add them under Guardians'); }
      if (item.classId) { try { await enroll(client, item.classId, id); } catch (e) { notes.push('not enrolled in ' + item.className + ' (' + err(e) + ')'); } }
      results.push({ line: item.line, name: item.name, ok: notes.length === 0,
        result: notes.length ? 'Student added, but ' + notes.join('; ') : 'Added' + (item.classId ? ' to ' + item.className : '') });
    }
    await reload();
    const added = results.filter(r => !r.result.startsWith('Not added')).length;
    setDone(results); setText(''); setFileName('');
    setProgress(`Finished: ${added} of ${ready.length} students added.` + (results.some(r => !r.ok) ? ' Check the rows marked below.' : ''));
    setBusy(false);
  }

  return <div className="people-enroll">
    <h3>Import students from a spreadsheet</h3>
    <ol>
      <li>Open the sheet (for example the old Google Form responses). It needs a first row with column names; <strong>Student name</strong>, <strong>Parent name</strong> and <strong>Parent phone</strong> (or <strong>Parent email</strong>) are required. <strong>Grade</strong>, <strong>Class</strong> (or <strong>Subject</strong> + <strong>Level</strong>), <strong>WhatsApp OK</strong> and <strong>Email OK</strong> are optional; other columns are ignored.</li>
      <li>Google Sheets: <strong>File → Download → Comma-separated values (.csv)</strong>. Excel: <strong>Save as → CSV UTF-8</strong>.</li>
      <li>Choose the file below, check the preview, then press <strong>Import</strong>.</li>
    </ol>
    <p className="quiet">Classes must already exist (Classes screen). A parent already on file with the same phone or email is reused for brothers and sisters. Parents are only marked as agreeing to WhatsApp or email where the sheet says yes. Use test data only until the privacy checklist is complete.</p>
    <p><button className="small-btn" type="button" onClick={() => download('bigchange-students-template.csv', toCsv(TEMPLATE_HEADER, [TEMPLATE_EXAMPLE]))}>Download template (CSV)</button></p>
    <label>Spreadsheet file (.csv)<input type="file" accept=".csv,text/csv" disabled={busy} onChange={e => void choose(e)} /></label>
    {plan?.error && <p className="ops-feedback" role="alert">{fileName}: {plan.error}</p>}
    {items.length > 0 && <>
      <p role="status"><strong>{fileName}</strong>: {items.length} rows · <strong>{ready.length} ready</strong> · {count('skip')} skipped · {count('problem')} with problems</p>
      {plan?.unknown && plan.unknown.length > 0 && <p className="quiet">Ignored columns: {plan.unknown.join(', ')}</p>}
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Import preview"><table><thead><tr><th>Row</th><th>Student</th><th>Parent</th><th>Phone / email</th><th>Class</th><th>Result</th></tr></thead><tbody>
        {items.map(i => <tr key={i.line}><td>{i.line}</td><td>{i.name || '—'}{i.grade ? <><br /><small>{i.grade}</small></> : null}</td><td>{i.parent.name || '—'}</td>
          <td>{[i.parent.phone, i.parent.email].filter(Boolean).join(' · ') || '—'}</td><td>{i.className || '—'}</td>
          <td><span className={'tag ' + (i.status === 'ready' ? 'green' : i.status === 'skip' ? 'amber' : 'red')}>{i.status === 'ready' ? 'Ready' : i.status === 'skip' ? 'Skip' : 'Problem'}</span>
            {i.problem && <><br /><small>{i.problem}</small></>}</td></tr>)}
      </tbody></table></div>
      {count('problem') > 0 && <p className="quiet">Rows with problems are not imported. Fix them in the sheet and import the file again: rows already imported are skipped.</p>}
      <button className="primary-btn" type="button" disabled={busy || !ready.length} onClick={() => void runImport()}>Import {ready.length} {ready.length === 1 ? 'student' : 'students'}</button>
    </>}
    <p className="ops-feedback" role="status" aria-live="polite">{progress}</p>
    {done.length > 0 && <div className="table-wrap" tabIndex={0} role="region" aria-label="Import results"><table><thead><tr><th>Row</th><th>Student</th><th>Result</th></tr></thead><tbody>
      {done.map(d => <tr key={d.line}><td>{d.line}</td><td>{d.name}</td><td><span className={'tag ' + (d.ok ? 'green' : 'amber')}>{d.ok ? 'Done' : 'Check'}</span> {d.result}</td></tr>)}
    </tbody></table></div>}
  </div>;
}
