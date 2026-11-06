-- BigChange Academy Hub: initial schema
-- Courses, lessons, assignments, submissions, quizzes, attendance and progress,
-- with Row Level Security on every table.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('student', 'teacher', 'admin');
create type public.attendance_status as enum ('present', 'absent', 'late', 'excused');

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role public.user_role not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every new auth user gets a profile. Role is always 'student' on sign-up;
-- only an admin can promote someone (see policies below).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Courses and membership
-- ---------------------------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  teacher_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);
create index courses_teacher_id_idx on public.courses (teacher_id);

create table public.enrollments (
  course_id uuid not null references public.courses (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  primary key (course_id, student_id)
);
create index enrollments_student_id_idx on public.enrollments (student_id);

-- ---------------------------------------------------------------------------
-- Content
-- ---------------------------------------------------------------------------
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  content text not null default '',
  position int not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create index lessons_course_id_idx on public.lessons (course_id);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  instructions text not null default '',
  due_at timestamptz,
  max_points int not null default 100 check (max_points > 0),
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create index assignments_course_id_idx on public.assignments (course_id);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  content text not null default '',
  submitted_at timestamptz not null default now(),
  points int check (points >= 0),
  feedback text,
  graded_at timestamptz,
  unique (assignment_id, student_id)
);
create index submissions_student_id_idx on public.submissions (student_id);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create index quizzes_course_id_idx on public.quizzes (course_id);

-- correct_index is kept here; students read questions through the
-- quiz_questions_public view, which leaves it out.
create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  prompt text not null,
  choices text[] not null check (cardinality(choices) between 2 and 6),
  correct_index int not null check (correct_index >= 0),
  position int not null default 0
);
create index quiz_questions_quiz_id_idx on public.quiz_questions (quiz_id);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  answers int[] not null default '{}',
  score int,
  submitted_at timestamptz not null default now()
);
create index quiz_attempts_quiz_id_idx on public.quiz_attempts (quiz_id);
create index quiz_attempts_student_id_idx on public.quiz_attempts (student_id);

-- ---------------------------------------------------------------------------
-- Attendance and progress
-- ---------------------------------------------------------------------------
create table public.attendance (
  course_id uuid not null references public.courses (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  session_date date not null,
  status public.attendance_status not null,
  note text,
  recorded_by uuid references public.profiles (id) on delete set null,
  primary key (course_id, student_id, session_date)
);
create index attendance_student_id_idx on public.attendance (student_id);

create table public.lesson_progress (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (lesson_id, student_id)
);
create index lesson_progress_student_id_idx on public.lesson_progress (student_id);

-- ---------------------------------------------------------------------------
-- Helper functions for RLS (security definer avoids recursive policy checks)
-- ---------------------------------------------------------------------------
create schema if not exists private;

create function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create function private.teaches(p_course uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.courses
    where id = p_course and teacher_id = (select auth.uid())
  );
$$;

create function private.enrolled_in(p_course uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.enrollments
    where course_id = p_course and student_id = (select auth.uid())
  );
$$;

create function private.is_teacher()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('teacher', 'admin')
  );
$$;

-- Teacher can see a student if the student is enrolled in one of their courses.
create function private.teaches_student(p_student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.enrollments e
    join public.courses c on c.id = e.course_id
    where e.student_id = p_student and c.teacher_id = (select auth.uid())
  );
$$;

grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.courses         enable row level security;
alter table public.enrollments     enable row level security;
alter table public.lessons         enable row level security;
alter table public.assignments     enable row level security;
alter table public.submissions     enable row level security;
alter table public.quizzes         enable row level security;
alter table public.quiz_questions  enable row level security;
alter table public.quiz_attempts   enable row level security;
alter table public.attendance      enable row level security;
alter table public.lesson_progress enable row level security;

-- Profiles
create policy "profiles: read own, taught students, or admin"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.is_admin() or private.teaches_student(id)
         or role in ('teacher', 'admin'));
create policy "profiles: update own name"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
create policy "profiles: admin manages all"
  on public.profiles for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Only admins may change a role (blocks self-promotion via "update own").
-- auth.uid() is null for service-role / SQL editor sessions, which are trusted.
create function private.guard_role_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role is distinct from old.role
     and (select auth.uid()) is not null
     and not private.is_admin() then
    raise exception 'only admins can change roles';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function private.guard_role_change();

-- Courses
create policy "courses: read if teacher, enrolled, or admin"
  on public.courses for select to authenticated
  using (teacher_id = (select auth.uid()) or private.enrolled_in(id) or private.is_admin());
create policy "courses: teachers create their own"
  on public.courses for insert to authenticated
  with check (teacher_id = (select auth.uid()) and private.is_teacher());
create policy "courses: teacher or admin updates"
  on public.courses for update to authenticated
  using (teacher_id = (select auth.uid()) or private.is_admin())
  with check (teacher_id = (select auth.uid()) or private.is_admin());
create policy "courses: teacher or admin deletes"
  on public.courses for delete to authenticated
  using (teacher_id = (select auth.uid()) or private.is_admin());

-- Enrollments (managed by the course teacher or an admin)
create policy "enrollments: read own or taught"
  on public.enrollments for select to authenticated
  using (student_id = (select auth.uid()) or private.teaches(course_id) or private.is_admin());
create policy "enrollments: teacher or admin manages"
  on public.enrollments for all to authenticated
  using (private.teaches(course_id) or private.is_admin())
  with check (private.teaches(course_id) or private.is_admin());

-- Lessons / assignments / quizzes: students see published items in enrolled courses
create policy "lessons: read"
  on public.lessons for select to authenticated
  using (private.teaches(course_id) or private.is_admin() or (published and private.enrolled_in(course_id)));
create policy "lessons: teacher manages"
  on public.lessons for all to authenticated
  using (private.teaches(course_id) or private.is_admin())
  with check (private.teaches(course_id) or private.is_admin());

create policy "assignments: read"
  on public.assignments for select to authenticated
  using (private.teaches(course_id) or private.is_admin() or (published and private.enrolled_in(course_id)));
create policy "assignments: teacher manages"
  on public.assignments for all to authenticated
  using (private.teaches(course_id) or private.is_admin())
  with check (private.teaches(course_id) or private.is_admin());

create policy "quizzes: read"
  on public.quizzes for select to authenticated
  using (private.teaches(course_id) or private.is_admin() or (published and private.enrolled_in(course_id)));
create policy "quizzes: teacher manages"
  on public.quizzes for all to authenticated
  using (private.teaches(course_id) or private.is_admin())
  with check (private.teaches(course_id) or private.is_admin());

-- Quiz questions: only teachers read the base table (it holds the answers)
create policy "quiz_questions: teacher manages"
  on public.quiz_questions for all to authenticated
  using (exists (select 1 from public.quizzes q where q.id = quiz_id
                 and (private.teaches(q.course_id) or private.is_admin())))
  with check (exists (select 1 from public.quizzes q where q.id = quiz_id
                      and (private.teaches(q.course_id) or private.is_admin())));

-- Student-facing questions without the answer key
create function private.quiz_visible(p_quiz uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.quizzes q
    where q.id = p_quiz
      and (private.teaches(q.course_id) or private.is_admin()
           or (q.published and private.enrolled_in(q.course_id)))
  );
$$;
grant execute on function private.quiz_visible(uuid) to authenticated;

create view public.quiz_questions_public
with (security_barrier = true) as
  select id, quiz_id, prompt, choices, position
  from public.quiz_questions
  where private.quiz_visible(quiz_id);
revoke all on public.quiz_questions_public from anon;
grant select on public.quiz_questions_public to authenticated;

-- Submissions: students write their own (until graded); teachers grade
create policy "submissions: read own or taught"
  on public.submissions for select to authenticated
  using (student_id = (select auth.uid()) or private.is_admin()
         or exists (select 1 from public.assignments a where a.id = assignment_id and private.teaches(a.course_id)));
create policy "submissions: student submits"
  on public.submissions for insert to authenticated
  with check (student_id = (select auth.uid()) and points is null and graded_at is null
              and exists (select 1 from public.assignments a where a.id = assignment_id
                          and a.published and private.enrolled_in(a.course_id)));
create policy "submissions: student edits ungraded"
  on public.submissions for update to authenticated
  using (student_id = (select auth.uid()) and graded_at is null)
  with check (student_id = (select auth.uid()) and points is null and graded_at is null);
create policy "submissions: teacher grades"
  on public.submissions for update to authenticated
  using (private.is_admin() or exists (select 1 from public.assignments a where a.id = assignment_id and private.teaches(a.course_id)))
  with check (private.is_admin() or exists (select 1 from public.assignments a where a.id = assignment_id and private.teaches(a.course_id)));

-- Quiz attempts: scored server-side by submit_quiz_attempt(); clients only read
create policy "quiz_attempts: read own or taught"
  on public.quiz_attempts for select to authenticated
  using (student_id = (select auth.uid()) or private.is_admin()
         or exists (select 1 from public.quizzes q where q.id = quiz_id and private.teaches(q.course_id)));

create function public.submit_quiz_attempt(p_quiz uuid, p_answers int[])
returns public.quiz_attempts
language plpgsql security definer set search_path = '' as $$
declare
  v_attempt public.quiz_attempts;
  v_score int;
begin
  if not exists (select 1 from public.quizzes q where q.id = p_quiz
                 and q.published and private.enrolled_in(q.course_id)) then
    raise exception 'quiz not available';
  end if;

  select count(*) into v_score
  from (select correct_index, row_number() over (order by position, id) as n
        from public.quiz_questions where quiz_id = p_quiz) qq
  where p_answers[qq.n] = qq.correct_index;

  insert into public.quiz_attempts (quiz_id, student_id, answers, score)
  values (p_quiz, (select auth.uid()), p_answers, v_score)
  returning * into v_attempt;
  return v_attempt;
end;
$$;
revoke all on function public.submit_quiz_attempt(uuid, int[]) from public, anon;
grant execute on function public.submit_quiz_attempt(uuid, int[]) to authenticated;

-- Attendance: teacher records, student reads own
create policy "attendance: read own or taught"
  on public.attendance for select to authenticated
  using (student_id = (select auth.uid()) or private.teaches(course_id) or private.is_admin());
create policy "attendance: teacher records"
  on public.attendance for all to authenticated
  using (private.teaches(course_id) or private.is_admin())
  with check (private.teaches(course_id) or private.is_admin());

-- Lesson progress: student marks own lessons complete
create policy "lesson_progress: read own or taught"
  on public.lesson_progress for select to authenticated
  using (student_id = (select auth.uid()) or private.is_admin()
         or exists (select 1 from public.lessons l where l.id = lesson_id and private.teaches(l.course_id)));
create policy "lesson_progress: student marks own"
  on public.lesson_progress for insert to authenticated
  with check (student_id = (select auth.uid())
              and exists (select 1 from public.lessons l where l.id = lesson_id
                          and l.published and private.enrolled_in(l.course_id)));
create policy "lesson_progress: student unmarks own"
  on public.lesson_progress for delete to authenticated
  using (student_id = (select auth.uid()));
