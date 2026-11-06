# BigChange Academy Hub

An independently developed learning platform for BigChange Academy.

## Project goals

- Responsive student and teacher dashboards suitable for Chromebooks
- Courses, lessons, assignments, quizzes, attendance, and progress tracking
- Accessible interface for learners aged 10–16
- Security and student privacy before real-user onboarding

## Planned stack

- React, TypeScript, and Vite for a lightweight web application
- Supabase for authentication and data (with Row Level Security)
- GitHub Actions for automated build and test checks

## Development principles

This is a new, original implementation—not a fork of Globussoft School MIS. Tools such as REA may be used to document features and public workflows we are authorized to inspect. Do not copy third-party source code, assets, branding, or protected designs.

Use synthetic student data during development. No real student accounts or records should be entered until authentication, authorization, privacy, and deployment are reviewed.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the publishable key
npm run dev
```

Get the URL and publishable key from Supabase Dashboard → Project Settings → API. Only the publishable (anon) key goes in the browser app, never the service role key.

## Database

The schema is in `supabase/migrations/`. It covers profiles (student / teacher / admin), courses, enrollments, lessons, assignments, submissions, quizzes, attendance and lesson progress, with Row Level Security on every table:

- Students see only published content in courses they're enrolled in, and only their own submissions, attempts, attendance and progress.
- Teachers manage their own courses and see only the students enrolled in them.
- Quiz answer keys stay hidden from students: they read `quiz_questions_public`, and `submit_quiz_attempt()` scores attempts on the server.
- New sign-ups are always `student`. Only an admin can change a role. Promote the first admin from the SQL editor:
  `update profiles set role = 'admin' where id = '<user uuid>';`

Apply the migration with the Supabase CLI (`supabase db push`) or by pasting it into the SQL editor.

## Status

Initial scaffold with Supabase auth and schema. Application development will happen in feature branches and merge to `main` only after checks pass.
