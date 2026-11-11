import { useState } from 'react';
import { listsAfter } from './loadPlan.mjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AttendanceRow, ClassRow, Course, Enrollment, Guardian, GuardianLink, Learner, PeriodRow, ReminderEvent, Session, Staff, TeacherPeriod } from './api';

export type Role = 'admin' | 'teacher' | 'finance' | 'learner' | 'guardian';
export type Data = {
  learners: Learner[]; courses: Course[]; staff: Staff[]; classes: ClassRow[]; enrollments: Enrollment[]; sessions: Session[];
  attendance: AttendanceRow[]; guardians: Guardian[]; links: GuardianLink[]; periods: PeriodRow[]; teacherPeriods: TeacherPeriod[]; reminders: ReminderEvent[];
};
export const EMPTY: Data = { learners: [], courses: [], staff: [], classes: [], enrollments: [], sessions: [], attendance: [],
  guardians: [], links: [], periods: [], teacherPeriods: [], reminders: [] };
/** 'records' = everything except lessons and attendance marks; 'attendance' = only those two; 'all' = everything. */
export type SaveScope = 'all' | 'records' | 'attendance';
export type Reload = (scope?: SaveScope) => Promise<void>;
export type PanelProps = { data: Data; client: SupabaseClient; reload: Reload };
export const listsToLoad = (scope: SaveScope, role: Role) => listsAfter(scope, role) as Array<keyof Data>;

/** Runs a save action once at a time, reloads what that save can have changed, and reports success or a safe error message. */
export function useAction(reload: Reload) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function run(task: () => Promise<void>, success: string, scope: SaveScope = 'records'): Promise<boolean> {
    if (busy) return false;
    setBusy(true); setMessage('');
    try { await task(); await reload(scope); setMessage(success); return true; }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Something went wrong'); return false; }
    finally { setBusy(false); }
  }
  return { message, busy, run };
}
