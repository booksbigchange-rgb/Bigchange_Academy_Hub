// Which lists each role loads, and which lists each kind of save changes. Pure, so it is unit tested.
export const ALL_KEYS = ['learners', 'courses', 'staff', 'classes', 'enrollments', 'sessions', 'attendance', 'guardians', 'links', 'periods', 'teacherPeriods', 'reminders'];

export function keysForRole(role) {
  const staffView = role === 'admin' || role === 'finance';
  return ALL_KEYS.filter(key => {
    if (key === 'staff') return role === 'admin';
    if (key === 'guardians' || key === 'links' || key === 'reminders') return staffView;
    if (key === 'periods') return staffView || role === 'guardian';
    if (key === 'teacherPeriods') return role === 'teacher';
    return true;
  });
}

export const TOUCHES = {
  learner: ['learners'],
  learnerWithGuardian: ['learners', 'guardians', 'links'],
  course: ['courses'],
  classes: ['classes'],
  enrollment: ['enrollments'],
  lesson: ['sessions'],
  attendance: ['attendance'],
  reminder: ['reminders'],
  guardianLink: ['guardians', 'links', 'periods', 'teacherPeriods'],
  consent: ['guardians', 'periods', 'teacherPeriods'],
  payment: ['periods', 'teacherPeriods']
};
