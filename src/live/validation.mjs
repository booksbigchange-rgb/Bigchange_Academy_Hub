/** Input validation for the live (database-backed) screens. Pure; mirrors database constraints. */
export const GRADE_LEVELS = Object.freeze(['Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10']);
const clean = v => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');
const unsafe = /[<>]/;

export function validateLearner({ name, gradeLevel = '', note = '' }) {
  const displayName = clean(name), n = clean(note), grade = clean(gradeLevel);
  if (displayName.length < 2 || displayName.length > 80) throw Error('Enter the student’s name (2 to 80 characters)');
  if (unsafe.test(displayName) || unsafe.test(n)) throw Error('Names and notes cannot contain < or >');
  if (n.length > 120) throw Error('Notes can be at most 120 characters');
  if (grade && !GRADE_LEVELS.includes(grade)) throw Error('Choose a valid grade level');
  return { display_name: displayName, grade_level: grade || null, note: n || null };
}

export function validateCourse({ title, description = '' }) {
  const t = clean(title), d = clean(description);
  if (t.length < 2 || t.length > 80) throw Error('Enter a course title (2 to 80 characters)');
  if (unsafe.test(t) || unsafe.test(d)) throw Error('Text cannot contain < or >');
  if (d.length > 300) throw Error('Description can be at most 300 characters');
  return { title: t, description: d || null };
}

export function validateClass({ title, courseId, teacherId = "" }) {
  const t = clean(title);
  if (t.length < 2 || t.length > 80) throw Error('Enter a class title (2 to 80 characters)');
  if (unsafe.test(t)) throw Error('Text cannot contain < or >');
  if (!courseId) throw Error('Choose a course');
  return { title: t, course_id: courseId, teacher_staff_id: teacherId || null };
}

/** Case-insensitive search over name fields. */
export function matchesSearch(text, query) {
  return clean(text).toLowerCase().includes(clean(query).toLowerCase());
}

/** Returns an error message if the learner cannot be enrolled in the class, else ''. */
export function enrollmentProblem({ learnerId, classId, enrollments, learners }) {
  const learner = learners.find(l => l.id === learnerId);
  if (!learner) return 'Choose a student';
  if (learner.active === false) return 'This student is inactive';
  if (!classId) return 'Choose a class';
  if (enrollments.some(e => e.class_id === classId && e.learner_id === learnerId)) return 'Already enrolled in this class';
  return '';
}
