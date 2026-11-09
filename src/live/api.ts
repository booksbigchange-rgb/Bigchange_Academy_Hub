import type { SupabaseClient } from '@supabase/supabase-js';
import { collectPages } from './paging.mjs';
import { validateClass, validateCourse, validateGuardian, validateLearner, validateReport, validateSession } from './validation.mjs';

export type Learner = { id: string; display_name: string; active: boolean; grade_level: string | null; note: string | null };
export type Course = { id: string; title: string; description: string | null };
export type Staff = { id: string; role: 'admin' | 'teacher' | 'finance'; display_name: string | null };
export type ClassRow = { id: string; title: string; course_id: string; teacher_staff_id: string | null };
export type Enrollment = { class_id: string; learner_id: string };

/** Turn a database error into a short, safe message (no internals). */
function fail(error: { message: string; code?: string } | null, action: string): never {
  if (error?.code === '23505') throw Error('That already exists');
  if (error?.code === '42501') throw Error('You are not allowed to ' + action);
  throw Error('Could not ' + action + '. Please try again.');
}
async function rows<T>(query: PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>, action: string): Promise<T[]> {
  const { data, error } = await query;
  if (error) fail(error, action);
  return data ?? [];
}

type Result<T> = { data: T[] | null; error: { message: string; code?: string } | null };
/** Supabase returns at most 1,000 rows per request by default, so lists are read page by page.
 * Each query must have a stable, unique ordering so pages neither skip nor repeat rows. */
export async function pages<T>(make: () => { range(from: number, to: number): PromiseLike<Result<T>> }, action: string): Promise<T[]> {
  const { rows: all, error } = await collectPages<T>((from, to) => make().range(from, to));
  if (error) fail(error, action);
  return all;
}

export const listLearners = (c: SupabaseClient) =>
  pages<Learner>(() => c.from('academy_learners').select('id,display_name,active,grade_level,note').order('display_name').order('id'), 'load students');
export const listCourses = (c: SupabaseClient) =>
  pages<Course>(() => c.from('academy_courses').select('id,title,description').order('title').order('id'), 'load courses');
export const listStaff = (c: SupabaseClient) =>
  pages<Staff>(() => c.from('academy_staff').select('id,role,display_name').order('display_name').order('id'), 'load staff');
export const listClasses = (c: SupabaseClient) =>
  pages<ClassRow>(() => c.from('academy_classes').select('id,title,course_id,teacher_staff_id').order('title').order('id'), 'load classes');
export const listEnrollments = (c: SupabaseClient) =>
  pages<Enrollment>(() => c.from('academy_enrollments').select('class_id,learner_id').order('class_id').order('learner_id'), 'load enrollments');

export async function addLearner(c: SupabaseClient, input: { name: string; gradeLevel?: string; note?: string }): Promise<string> {
  const { data, error } = await c.from('academy_learners').insert(validateLearner(input)).select('id').single();
  if (error) fail(error, 'add the student');
  return (data as { id: string }).id;
}
type GuardianInput = { name: string; email?: string; phone?: string; emailOptIn?: boolean; whatsappOptIn?: boolean };
/**
 * Add a student and their parent in one step. Both are validated before anything is saved. If the parent's phone or
 * email already exists, the student is linked to that same parent (siblings share one parent record).
 * Returns a warning if the student was saved but the parent could not be.
 */
export async function addLearnerWithGuardian(c: SupabaseClient, learner: { name: string; gradeLevel?: string; note?: string }, guardian: GuardianInput): Promise<string> {
  validateLearner(learner);
  validateGuardian(guardian);
  const id = await addLearner(c, learner);
  try { await addGuardian(c, id, guardian); return ''; }
  catch (error) { return 'Student added, but the parent was not saved: ' + (error instanceof Error ? error.message : 'unknown error') + '. Add the parent under Guardians.'; }
}
/** RLS can silently match zero rows; treat that as "not permitted". */
export async function updateLearner(c: SupabaseClient, id: string, input: { name: string; gradeLevel?: string; note?: string; active?: boolean }) {
  const patch: Record<string, unknown> = validateLearner(input);
  if (typeof input.active === 'boolean') patch.active = input.active;
  const { data, error } = await c.from('academy_learners').update(patch).eq('id', id).select('id');
  if (error) fail(error, 'update the student');
  if (!data?.length) throw Error('You are not allowed to update this student');
}
export async function addCourse(c: SupabaseClient, input: { title: string; description?: string }) {
  const { error } = await c.from('academy_courses').insert(validateCourse(input));
  if (error) fail(error, 'add the course');
}
export async function addClass(c: SupabaseClient, input: { title: string; courseId: string; teacherId?: string }) {
  const { error } = await c.from('academy_classes').insert(validateClass(input));
  if (error) fail(error, 'add the class');
}
export async function enroll(c: SupabaseClient, classId: string, learnerId: string) {
  const { error } = await c.from('academy_enrollments').insert({ class_id: classId, learner_id: learnerId });
  if (error) fail(error, 'enroll the student');
}
export async function unenroll(c: SupabaseClient, classId: string, learnerId: string) {
  const { data, error } = await c.from('academy_enrollments').delete().eq('class_id', classId).eq('learner_id', learnerId).select('class_id');
  if (error) fail(error, 'remove the enrollment');
  if (!data?.length) throw Error('You are not allowed to remove this enrollment');
}

export type Session = { id: string; class_id: string; starts_at: string };
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';
export type AttendanceRow = { session_id: string; learner_id: string; status: AttendanceStatus };

export const listSessions = (c: SupabaseClient) =>
  pages<Session>(() => c.from('academy_sessions').select('id,class_id,starts_at').order('starts_at', { ascending: false }).order('id'), 'load lessons');
export const listAttendance = (c: SupabaseClient) =>
  pages<AttendanceRow>(() => c.from('academy_attendance').select('session_id,learner_id,status').order('session_id').order('learner_id'), 'load attendance');

export async function addSession(c: SupabaseClient, classId: string, input: { date: string; time: string }) {
  const { error } = await c.from('academy_sessions').insert({ class_id: classId, starts_at: validateSession(input) });
  if (error) fail(error, 'add the lesson');
}
/** The signed-in staff member's id, needed to attribute attendance. */
export async function myStaffId(c: SupabaseClient): Promise<string> {
  const { data: auth } = await c.auth.getUser();
  if (!auth.user) throw Error('Please sign in again');
  const { data, error } = await c.from('academy_staff').select('id').eq('auth_user_id', auth.user.id).maybeSingle();
  if (error || !data) throw Error('Your staff profile could not be found');
  return data.id as string;
}
/** Save marks for a lesson. One row per (lesson, student); saving again updates the existing mark. */
export async function saveAttendance(c: SupabaseClient, sessionId: string, marks: Record<string, AttendanceStatus>) {
  const staffId = await myStaffId(c);
  const payload = Object.entries(marks).map(([learner_id, status]) => ({
    session_id: sessionId, learner_id, status, recorded_by_staff_id: staffId }));
  if (!payload.length) throw Error('Mark at least one student');
  const { data, error } = await c.from('academy_attendance').upsert(payload, { onConflict: 'session_id,learner_id' }).select('learner_id');
  if (error) fail(error, 'save attendance');
  if ((data?.length ?? 0) !== payload.length) throw Error('Some marks were not saved. You may not be allowed to record them.');
}

export type Guardian = { id: string; display_name: string; email: string | null; phone_e164: string | null; email_opt_in: boolean; whatsapp_opt_in: boolean };
export type GuardianLink = { learner_id: string; guardian_id: string; verified: boolean };
export type GuardianContact = { guardian_id: string; display_name: string; email: string | null; phone_e164: string | null; email_opt_in: boolean; whatsapp_opt_in: boolean; verified: boolean };
export type FeeStatus = 'unpaid' | 'partial' | 'paid';
export type PeriodRow = { id: string; guardian_id: string; period_start: string; period_end: string; course_count: number; amount_due: number; currency_code: string;
  reported_status: FeeStatus; paid_on: string | null; paid_method: string | null; paid_note: string | null; checked_status: FeeStatus; approved_status: FeeStatus;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue'; stage: 'none' | 'reported' | 'checked' | 'approved' };
export type TeacherPeriod = { period_id: string; guardian_id: string; guardian_name: string; guardian_phone: string | null; period_start: string; period_end: string; amount_due: number;
  status: PeriodRow['status']; stage: PeriodRow['stage']; reported_status: FeeStatus; paid_on: string | null; paid_method: string | null; paid_note: string | null; students: string[]; courses: string[] };

export const listGuardians = (c: SupabaseClient) =>
  pages<Guardian>(() => c.from('academy_guardians').select('id,display_name,email,phone_e164,email_opt_in,whatsapp_opt_in').order('display_name').order('id'), 'load guardians');
export async function listLinks(c: SupabaseClient): Promise<GuardianLink[]> {
  const data = await pages<{ learner_id: string; guardian_id: string; verified_by_staff_id: string | null }>(
    () => c.from('academy_guardian_links').select('learner_id,guardian_id,verified_by_staff_id').order('learner_id').order('guardian_id'), 'load guardian links');
  return data.map(l => ({ learner_id: l.learner_id, guardian_id: l.guardian_id, verified: l.verified_by_staff_id !== null }));
}
export const listPeriods = (c: SupabaseClient) =>
  pages<PeriodRow>(() => c.from('academy_fee_period_status').select('*').order('period_start', { ascending: false }).order('id'), 'load payment periods');
export async function teacherPeriods(c: SupabaseClient): Promise<TeacherPeriod[]> {
  return pages<TeacherPeriod>(() => c.rpc('academy_teacher_fee_periods') as unknown as { range(from: number, to: number): PromiseLike<Result<TeacherPeriod>> }, 'load payment status');
}
export async function guardiansForLearner(c: SupabaseClient, learnerId: string): Promise<GuardianContact[]> {
  return rows<GuardianContact>(c.rpc('academy_guardians_for_learner', { p_learner: learnerId }) as unknown as PromiseLike<{ data: GuardianContact[] | null; error: { message: string; code?: string } | null }>, 'load guardian contacts');
}
export async function addGuardian(c: SupabaseClient, learnerId: string, input: { name: string; email?: string; phone?: string; emailOptIn?: boolean; whatsappOptIn?: boolean }) {
  const { error } = await c.rpc('academy_add_guardian', { p_learner: learnerId, ...validateGuardian(input) });
  if (error) {
    if (error.code === '42501') throw Error('You are not allowed to add a guardian for this student');
    if (/^(Enter|Add|Not allowed)/.test(error.message)) throw Error(error.message);
    fail(error, 'add the guardian');
  }
}
export async function verifyLink(c: SupabaseClient, learnerId: string, guardianId: string) {
  const staffId = await myStaffId(c);
  const { data, error } = await c.from('academy_guardian_links').update({ verified_by_staff_id: staffId })
    .eq('learner_id', learnerId).eq('guardian_id', guardianId).select('learner_id');
  if (error) fail(error, 'verify the guardian');
  if (!data?.length) throw Error('You are not allowed to verify this guardian');
}
/** Messages raised deliberately by the database workflow rules are safe to show. */
const WORKFLOW = /^(Not allowed|Enter|Choose|The payment|Note|This parent|Check only|Approve only|Only finance|Only an administrator|Payment period|Period details)/;
function workflowFail(error: { message: string; code?: string }, action: string): never {
  if (error.code === '42501') throw Error('You are not allowed to ' + action);
  if (WORKFLOW.test(error.message)) throw Error(error.message);
  fail(error, action);
}
export async function familyFee(c: SupabaseClient, guardianId: string): Promise<{ course_count: number; amount_due: number }> {
  const { data, error } = await c.rpc('academy_family_fee', { p_guardian: guardianId });
  if (error) workflowFail(error, 'work out the fee');
  const row = (data as Array<{ course_count: number; amount_due: number }> | null)?.[0];
  if (!row) throw Error('Could not work out the fee');
  return row;
}
export async function createPeriod(c: SupabaseClient, guardianId: string, start: string) {
  const { error } = await c.rpc('academy_create_fee_period', { p_guardian: guardianId, p_start: start });
  if (error) workflowFail(error, 'start the payment period');
}
/** Report what a parent paid. A form teacher of any of the parent's children, finance or admin may do this; finance then checks and an admin approves. */
export async function reportPayment(c: SupabaseClient, periodId: string, input: { status: FeeStatus; paidOn?: string; method?: string; note?: string }, today: string, periodStart: string) {
  const { error } = await c.rpc('academy_report_payment', { p_period: periodId, ...validateReport(input, today, periodStart) });
  if (error) workflowFail(error, 'report this payment');
}
export async function checkPeriod(c: SupabaseClient, periodId: string, status: FeeStatus) {
  const { data, error } = await c.from('academy_fee_periods').update({ checked_status: status }).eq('id', periodId).select('id');
  if (error) workflowFail(error, 'check this payment');
  if (!data?.length) throw Error('You are not allowed to check this payment');
}
export async function approvePeriod(c: SupabaseClient, periodId: string, status: FeeStatus) {
  const { data, error } = await c.from('academy_fee_periods').update({ approved_status: status }).eq('id', periodId).select('id');
  if (error) workflowFail(error, 'approve this payment');
  if (!data?.length) throw Error('You are not allowed to approve this payment');
}

export async function setClassTeacher(c: SupabaseClient, classId: string, staffId: string) {
  const { data, error } = await c.from('academy_classes').update({ teacher_staff_id: staffId || null }).eq('id', classId).select('id');
  if (error) fail(error, 'change the teacher');
  if (!data?.length) throw Error('You are not allowed to change this class');
}

export async function updateCourse(c: SupabaseClient, id: string, input: { title: string; description?: string }) {
  const { data, error } = await c.from('academy_courses').update(validateCourse(input)).eq('id', id).select('id');
  if (error) fail(error, 'update the course');
  if (!data?.length) throw Error('You are not allowed to update this course');
}
export async function renameClass(c: SupabaseClient, id: string, title: string) {
  const t = title.trim().replace(/\s+/g, ' ');
  if (t.length < 2 || t.length > 80 || /[<>]/.test(t)) throw Error('Enter a class title (2 to 80 characters)');
  const { data, error } = await c.from('academy_classes').update({ title: t }).eq('id', id).select('id');
  if (error) fail(error, 'rename the class');
  if (!data?.length) throw Error('You are not allowed to rename this class');
}
