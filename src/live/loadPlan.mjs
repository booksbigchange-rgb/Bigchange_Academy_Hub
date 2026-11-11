// What each role sees and loads, and what has to be loaded again after a save. Pure rules, no network.

/** Screens per role, first one opens after sign-in. Parents and students have records but, while the app is an
 *  internal management system, no screens unless family sign-in is switched on. */
export function sectionsForRole(role, familySignIn = false) {
  if (role === 'admin') return ['Overview', 'Students', 'Guardians', 'Courses', 'Classes', 'Attendance', 'Fees', 'Notices'];
  if (role === 'teacher') return ['Overview', 'Students', 'Guardians', 'Classes', 'Attendance', 'Fees', 'Notices'];
  if (role === 'finance') return ['Fees', 'Overview', 'Guardians', 'Students'];
  if (role === 'guardian') return familySignIn ? ['My children', 'Payments'] : [];
  if (role === 'learner') return familySignIn ? ['My classes'] : [];
  return [];
}

const ATTENDANCE_LISTS = ['sessions', 'attendance'];

/** The lists a role is allowed to load. Everything else stays empty for that role. */
export function listsForRole(role) {
  const lists = ['learners', 'courses', 'classes', 'enrollments', ...ATTENDANCE_LISTS];
  if (role === 'admin') lists.push('staff');
  if (role === 'admin' || role === 'finance') lists.push('guardians', 'links', 'periods', 'reminders');
  if (role === 'guardian') lists.push('periods');
  if (role === 'teacher') lists.push('teacherPeriods');
  return lists;
}

/** After a save, load again only what that save can have changed. Lessons and attendance marks are by far the
 *  largest lists and only the Attendance screen changes them, so every other save leaves them alone. */
export function listsAfter(scope, role) {
  const allowed = listsForRole(role);
  if (scope === 'all') return allowed;
  return allowed.filter(name => ATTENDANCE_LISTS.includes(name) === (scope === 'attendance'));
}
