import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  listAttendance, listClasses, listCourses, listEnrollments, listGuardians, listLearners, listLinks, listPeriods, listReminders, listSessions, listStaff, teacherPeriods
} from './api';
import { EMPTY, type Data, type Role } from './shared';
import { ALL_KEYS, TOUCHES, keysForRole } from './loading.mjs';

/** One name per list the screens read. A save names the lists it changed; only those are fetched again. */
export type DataKey = keyof Data;

export { ALL_KEYS, TOUCHES, keysForRole };

const LOADERS: { [K in DataKey]: (client: SupabaseClient) => Promise<Data[K]> } = {
  learners: listLearners, courses: listCourses, staff: listStaff, classes: listClasses, enrollments: listEnrollments,
  sessions: listSessions, attendance: listAttendance, guardians: listGuardians, links: listLinks, periods: listPeriods,
  teacherPeriods, reminders: listReminders
};

export type Reload = (keys?: readonly string[]) => Promise<void>;

/** Owns the role-based loading. The first load fills everything; later reloads replace only the named lists, without hiding the screen. */
export function useAcademyData(client: SupabaseClient, role: Role) {
  const [data, setData] = useState<Data>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const reload = useCallback<Reload>(async keys => {
    const allowed = keysForRole(role) as DataKey[];
    const wanted = keys ? allowed.filter(key => keys.includes(key)) : allowed; // unknown names are ignored
    setLoadError('');
    try {
      const entries = await Promise.all(wanted.map(async key => [key, await LOADERS[key](client)] as const));
      setData(previous => ({ ...previous, ...Object.fromEntries(entries) }));
    } catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not load data'); }
    finally { setLoading(false); }
  }, [client, role]);

  useEffect(() => { void reload(); }, [reload]);
  return { data, loading, loadError, reload };
}

/**
 * A list that belongs to one thing on screen (a class, a student), loaded when that thing is chosen.
 * `scope` is the id of the thing ('' = nothing chosen). `ready` is false until its rows have arrived,
 * so a screen never acts on rows that belong to the previous choice. `refresh` loads it again after a save.
 */
export function useScoped<T>(scope: string, load: () => Promise<T[]>) {
  const [state, setState] = useState<{ scope: string; rows: T[]; error: string }>({ scope: '', rows: [], error: '' });
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    if (!scope) return;
    let live = true;
    loadRef.current().then(rows => { if (live) setState({ scope, rows, error: '' }); })
      .catch(error => { if (live) setState({ scope, rows: [], error: error instanceof Error ? error.message : 'Could not load' }); });
    return () => { live = false; };
  }, [scope]);
  const refresh = useCallback(async () => {
    if (!scope) return;
    const rows = await loadRef.current();
    setState({ scope, rows, error: '' });
  }, [scope]);
  const current = state.scope === scope && scope !== '';
  return { rows: current ? state.rows : [] as T[], ready: current && !state.error, error: current ? state.error : '', refresh };
}
