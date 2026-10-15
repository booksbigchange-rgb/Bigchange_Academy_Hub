-- DRAFT ONLY. DO NOT APPLY TO EXISTING SUPABASE PROJECTS.
-- This starts deny-by-default with RLS enabled on every table. No access policies.
-- Actual data operations require separate tested authorization migrations.
create table if not exists public.academy_staff(id uuid primary key default gen_random_uuid(),auth_user_id uuid not null unique references auth.users(id),role text not null check(role in ('admin','teacher','finance')));
create table if not exists public.academy_learners(id uuid primary key default gen_random_uuid(),auth_user_id uuid unique references auth.users(id),display_name text not null,active boolean not null default true);
create table if not exists public.academy_guardians(id uuid primary key default gen_random_uuid(),auth_user_id uuid unique references auth.users(id),display_name text not null,email text,phone_e164 text,email_opt_in boolean not null default false,whatsapp_opt_in boolean not null default false);
create table if not exists public.academy_guardian_links(learner_id uuid not null references public.academy_learners(id),guardian_id uuid not null references public.academy_guardians(id),verified_by_staff_id uuid references public.academy_staff(id),primary key(learner_id,guardian_id));
create table if not exists public.academy_courses(id uuid primary key default gen_random_uuid(),title text not null,description text);
create table if not exists public.academy_classes(id uuid primary key default gen_random_uuid(),course_id uuid not null references public.academy_courses(id),teacher_staff_id uuid references public.academy_staff(id),title text not null);
create table if not exists public.academy_enrollments(class_id uuid not null references public.academy_classes(id),learner_id uuid not null references public.academy_learners(id),primary key(class_id,learner_id));
create table if not exists public.academy_sessions(id uuid primary key default gen_random_uuid(),class_id uuid not null references public.academy_classes(id),starts_at timestamptz not null);
create table if not exists public.academy_attendance(session_id uuid not null references public.academy_sessions(id),learner_id uuid not null references public.academy_learners(id),status text not null check(status in ('present','absent','late','excused')),recorded_by_staff_id uuid references public.academy_staff(id),primary key(session_id,learner_id));
create table if not exists public.academy_assignments(id uuid primary key default gen_random_uuid(),class_id uuid not null references public.academy_classes(id),title text not null,description text);
create table if not exists public.academy_submissions(id uuid primary key default gen_random_uuid(),assignment_id uuid not null references public.academy_assignments(id),learner_id uuid not null references public.academy_learners(id),submitted_at timestamptz not null default now(),status text not null default 'submitted',unique(assignment_id,learner_id));
create table if not exists public.academy_fee_obligations(id uuid primary key default gen_random_uuid(),learner_id uuid not null references public.academy_learners(id),term text not null,amount_due numeric(12,2) not null check(amount_due>0),currency_code text not null default 'ETB' check(currency_code='ETB'));
create table if not exists public.academy_external_payments(id uuid primary key default gen_random_uuid(),obligation_id uuid not null references public.academy_fee_obligations(id),amount numeric(12,2) not null check(amount>0),method text not null,external_reference text,recorded_by_staff_id uuid not null references public.academy_staff(id),verified_by_staff_id uuid references public.academy_staff(id),recorded_at timestamptz not null default now());
create table if not exists public.academy_audit_events(id bigint generated always as identity primary key,actor_id uuid references auth.users(id),action text not null,entity_type text not null,created_at timestamptz not null default now());
alter table public.academy_staff enable row level security;
alter table public.academy_staff force row level security;
alter table public.academy_learners enable row level security;
alter table public.academy_learners force row level security;
alter table public.academy_guardians enable row level security;
alter table public.academy_guardians force row level security;
alter table public.academy_guardian_links enable row level security;
alter table public.academy_guardian_links force row level security;
alter table public.academy_courses enable row level security;
alter table public.academy_courses force row level security;
alter table public.academy_classes enable row level security;
alter table public.academy_classes force row level security;
alter table public.academy_enrollments enable row level security;
alter table public.academy_enrollments force row level security;
alter table public.academy_sessions enable row level security;
alter table public.academy_sessions force row level security;
alter table public.academy_attendance enable row level security;
alter table public.academy_attendance force row level security;
alter table public.academy_assignments enable row level security;
alter table public.academy_assignments force row level security;
alter table public.academy_submissions enable row level security;
alter table public.academy_submissions force row level security;
alter table public.academy_fee_obligations enable row level security;
alter table public.academy_fee_obligations force row level security;
alter table public.academy_external_payments enable row level security;
alter table public.academy_external_payments force row level security;
alter table public.academy_audit_events enable row level security;
alter table public.academy_audit_events force row level security;
-- No CREATE POLICY statements. Until reviewed RLS policies are added, normal
-- authenticated/anonymous clients cannot read or modify these domain tables.
-- Actual payment verification, ledger reconciliation, immutable auditing,
-- student-parent authorization and cross-record validation remain unimplemented.
