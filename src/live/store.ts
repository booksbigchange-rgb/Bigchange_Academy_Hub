import { useCallback, useEffect, useState } from 'react';
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
