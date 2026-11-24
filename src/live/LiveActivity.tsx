import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listAuditEvents, type AuditEvent } from './api';
import { CATEGORIES, activityLookups, dayLabel, describeEvent } from './activity.mjs';
import { toCsv, todayIso } from './fees.mjs';
import type { Data } from './shared';

type Item = { id: number; at: string; who: string; category: string; text: string };
const PAGE = 200;

/** Admin: who changed what and when, in plain words. Read from the audit trail the database writes itself. */
export default function LiveActivity({ client, data }: { client: SupabaseClient; data: Data }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [more, setMore] = useState(false);
  const [category, setCategory] = useState('');
  const [who, setWho] = useState('');
  const [query, setQuery] = useState('');
  const load = useCallback(async (offset: number) => {
    setLoading(true);
    try {
      const rows = await listAuditEvents(client, offset, PAGE);
      setEvents(prev => (offset === 0 ? rows : [...prev, ...rows]));
      setMore(rows.length === PAGE); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load the activity log'); }
    finally { setLoading(false); }
  }, [client]);
  useEffect(() => { void load(0); }, [load]);
  const lookups = useMemo(() => activityLookups(data), [data]);
  const items: Item[] = useMemo(() => events.map(e => describeEvent(e, lookups)), [events, lookups]);
  const people = useMemo(() => [...new Set(items.map(i => i.who))].sort(), [items]);
  const q = query.trim().toLowerCase();
  const shown = items.filter(i => (!category || i.category === category) && (!who || i.who === who) && (!q || i.text.toLowerCase().includes(q)));
  const groups: Array<[string, Item[]]> = [];
  for (const i of shown) { const label = dayLabel(i.at); const last = groups[groups.length - 1]; if (last && last[0] === label) last[1].push(i); else groups.push([label, [i]]); }
  function downloadCsv() {
    const rows = shown.map(i => { const d = new Date(i.at); return [d.toLocaleDateString('en-CA'), d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), i.who, i.category, i.text]; });
    const url = URL.createObjectURL(new Blob([toCsv(['Date', 'Time', 'Who', 'Area', 'What happened'], rows)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `bigchange-activity-${todayIso()}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="activity">
    <p className="quiet">Every change is recorded by the database itself: payments (started, reported, checked, approved, fee changes with the reason), attendance marks, enrollments, parents and their permissions, staff roles and access. Nobody can edit or delete these records.</p>
    <div className="activity-filters">
      <label>Area<select value={category} onChange={e => setCategory(e.target.value)}><option value="">All</option>{CATEGORIES.map((c: string) => <option key={c}>{c}</option>)}</select></label>
      <label>Who<select value={who} onChange={e => setWho(e.target.value)}><option value="">Everyone</option>{people.map(p => <option key={p}>{p}</option>)}</select></label>
      <label>Search<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Name of a student, parent or class" /></label>
      <button className="small-btn" type="button" disabled={!shown.length} onClick={downloadCsv}>Download (CSV)</button>
    </div>
    {error && <p className="ops-feedback" role="alert">{error}</p>}
    {loading && !events.length && <p role="status">Loading…</p>}
    {!loading && !error && shown.length === 0 && <p className="quiet">{events.length ? 'Nothing matches these filters.' : 'No activity recorded yet.'}</p>}
    {groups.map(([label, list]) => <section key={label} className="activity-day" aria-label={label}>
      <h3>{label}</h3>
      <ul className="activity-list">{list.map(i => <li key={i.id}>
        <time dateTime={i.at}>{new Date(i.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</time>
        <span className="activity-text"><strong>{i.who}</strong> {i.text.charAt(0).toLowerCase() + i.text.slice(1)}</span>
        <span className="tag cat">{i.category}</span></li>)}</ul>
    </section>)}
    {more && <p><button className="small-btn" type="button" disabled={loading} onClick={() => void load(events.length)}>{loading ? 'Loading…' : 'Show older activity'}</button></p>}
  </div>;
}
