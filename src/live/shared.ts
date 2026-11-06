import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AttendanceRow, ClassRow, Course, Enrollment, FeeRow, Guardian, GuardianLink, Learner, Session, Staff, TeacherFee } from './api';

export type Role = 'admin' | 'teacher' | 'finance' | 'learner' | 'guardian';
export type Data = {
  learners: Learner[]; courses: Course[]; staff: Staff[]; classes: ClassRow[]; enrollments: Enrollment[]; sessions: Session[];
  attendance: AttendanceRow[]; guardians: Guardian[]; links: GuardianLink[]; fees: FeeRow[]; teacherFees: TeacherFee[];
};
export const EMPTY: Data = { learners: [], courses: [], staff: [], classes: [], enrollments: [], sessions: [], attendance: [],
  guardians: [], links: [], fees: [], teacherFees: [] };
export type PanelProps = { data: Data; client: SupabaseClient; reload: () => Promise<void> };

/** Runs a save action once at a time, reloads data, and reports success or a safe error message. */
export function useAction(reload: () => Promise<void>) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function run(task: () => Promise<void>, success: string): Promise<boolean> {
    if (busy) return false;
    setBusy(true); setMessage('');
    try { await task(); await reload(); setMessage(success); return true; }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Something went wrong'); return false; }
    finally { setBusy(false); }
  }
  return { message, busy, run };
}
