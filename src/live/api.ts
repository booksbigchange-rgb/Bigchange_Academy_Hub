import type { SupabaseClient } from '@supabase/supabase-js';
import { validateClass, validateCourse, validateGuardian, validateLearner, validateSession } from './validation.mjs';

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

export const listLearners = (c: SupabaseClient) =>
  rows<Learner>(c.from('academy_learners').select('id,display_name,active,grade_level,note').order('display_name'), 'load students');
export const listCourses = (c: SupabaseClient) =>
  rows<Course>(c.from('academy_courses').select('id,title,description').order('title'), 'load courses');
export const listStaff = (c: SupabaseClient) =>
  rows<Staff>(c.from('academy_staff').select('id,role,display_name').order('display_name'), 'load staff');
export const listClasses = (c: SupabaseClient) =>
  rows<ClassRow>(c.from('academy_classes').select('id,title,course_id,teacher_staff_id').order('title'), 'load classes');
export const listEnrollments = (c: SupabaseClient) =>
  rows<Enrollment>(c.from('academy_enrollments').select('class_id,learner_id'), 'load enrollments');

export async function addLearner(c: SupabaseClient, input: { name: string; gradeLevel?: string; note?: string }) {
  const { error } = await c.from('academy_learners').insert(validateLearner(input));
  if (error) fail(error, 'add the student');
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
  rows<Session>(c.from('academy_sessions').select('id,class_id,starts_at').order('starts_at', { ascending: false }), 'load lessons');
export const listAttendance = (c: SupabaseClient) =>
  rows<AttendanceRow>(c.from('academy_attendance').select('session_id,learner_id,status'), 'load attendance');

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
export type FeeRow = { obligation_id: string; learner_id: string; course_id: string | null; guardian_id: string | null; period: string | null; term: string; amount_due: number;
  recorded_status: FeeStatus; approved_status: FeeStatus; status: 'unpaid' | 'partial' | 'paid' | 'overdue'; pending_approval: boolean };
export type TeacherFee = { learner_id: string; course_id: string; period: string; status: 'unpaid' | 'partial' | 'paid' | 'overdue' };

export const listGuardians = (c: SupabaseClient) =>
  rows<Guardian>(c.from('academy_guardians').select('id,display_name,email,phone_e164,email_opt_in,whatsapp_opt_in').order('display_name'), 'load guardians');
export async function listLinks(c: SupabaseClient): Promise<GuardianLink[]> {
  const data = await rows<{ learner_id: string; guardian_id: string; verified_by_staff_id: string | null }>(
    c.from('academy_guardian_links').select('learner_id,guardian_id,verified_by_staff_id'), 'load guardian links');
  return data.map(l => ({ learner_id: l.learner_id, guardian_id: l.guardian_id, verified: l.verified_by_staff_id !== null }));
}
export const listFees = (c: SupabaseClient) =>
  rows<FeeRow>(c.from('academy_fee_status').select('*').order('period', { ascending: false }), 'load fees');
export async function teacherFees(c: SupabaseClient): Promise<TeacherFee[]> {
  return rows<TeacherFee>(c.rpc('academy_teacher_fee_status') as unknown as PromiseLike<{ data: TeacherFee[] | null; error: { message: string; code?: string } | null }>, 'load payment status');
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
export async function createFees(c: SupabaseClient, fees: Array<{ learner_id: string; course_id: string; guardian_id: string; period: string; term: string; amount_due: number }>) {
  if (!fees.length) throw Error('There are no new fees to create');
  const { error } = await c.from('academy_fee_obligations').insert(fees);
  if (error) fail(error, 'create the fees');
}
/** Finance (or admin) records what the parent has paid; an admin must still approve it. */
export async function recordFeeStatus(c: SupabaseClient, obligationId: string, status: FeeStatus) {
  const { data, error } = await c.from('academy_fee_obligations').update({ recorded_status: status }).eq('id', obligationId).select('id');
  if (error) fail(error, 'record the payment status');
  if (!data?.length) throw Error('You are not allowed to record this payment status');
}
export async function approveFeeStatus(c: SupabaseClient, obligationId: string, status: FeeStatus) {
  const { data, error } = await c.from('academy_fee_obligations').update({ approved_status: status }).eq('id', obligationId).select('id');
  if (error) {
    if (/Approve only|Only an administrator/.test(error.message)) throw Error(error.message);
    fail(error, 'approve the payment status');
  }
  if (!data?.length) throw Error('You are not allowed to approve this payment status');
}
