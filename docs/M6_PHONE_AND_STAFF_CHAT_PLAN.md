# M6 plan: Hub on phones + staff chat

Status: **steps 1–3 built (2026-11-21); steps 4–9 not started.** Agreed with the owner on 2026-11-21 through the planning interview.

## Goal
Make the Hub an **installable website** (PWA) that staff add to their phone's home screen, and add **staff chat** so the school no longer needs staff WhatsApp groups.

Users: **admin, teachers, finance only.** Parents and students keep the website as now and get no chat.

## Decisions
| Topic | Decision |
|---|---|
| Phone app type | Installable website first; Expo app only later if needed |
| Main reason | Staff chat (replace WhatsApp between staff) |
| Conversations | One-to-one + automatic groups: All staff, Teachers, Finance, one per class (that class's teachers + admins) |
| Content | Text, photos, files up to **10 MB** (PDF, Word, Excel, PowerPoint, images, CSV), plus Google Drive links shown as a card |
| Privacy | Private by default; any member can **report** a message; admin can then open that conversation; every admin view is logged |
| Phones | Mix of Android and iPhone |

## Assumptions (owner said "fine"; can be changed)
1. Under 50 staff, each with their own phone.
2. Delete own message within 15 minutes; no editing.
3. Messages and files kept for one school year, then removed by a cleanup job.
4. Supabase free plan (1 GB storage) and Sentry free plan are enough to start.
5. No deadline.

## Out of scope for v1
Parents/students in chat, staff-made groups, voice notes, editing messages, read receipts per person, App Store / Expo app, likes/stories/follows, Clerk, Convex.

## Steps (each one a branch + pull request, tested before the next)

### Step 1. Phone-ready Hub (PWA) — no database change — ✅ built
Built: manifest + icons (`public/manifest.webmanifest`, `public/icons/`), offline helper `public/sw.js` (app files only; school data never stored), install banner for staff only (`src/live/InstallBanner.tsx`, logic in `src/live/install.mjs`), bottom tab bar on phones, CSP updated. Checked: 138 unit tests, 126/126 browser checks incl. axe, production build with the real headers opens offline with no blocked content. Still to do on real phones: install on one Android and one iPhone once the Hub is online. Wide tables already scroll inside their card; turning them into cards is left for later if staff find them hard to use.

Planned:
- `public/manifest.webmanifest` (name, icons 192/512 + maskable, theme colour, `display: standalone`), linked from `index.html`.
- Service worker (`public/sw.js`): caches the app shell only, **never** caches Supabase data or files (privacy).
- "Install the Hub" banner: Android uses the browser's install prompt; iPhone shows a 3-step "Share → Add to Home Screen" guide.
- Phone pass on every staff screen at 390px: bottom tab bar on phones, wide tables become cards.
- Update `public/_headers` CSP (`worker-src 'self'`, `manifest-src 'self'`).
- Tests: browser checks at phone width for every role, Lighthouse "installable", axe.

### Step 2. Chat database (migration 0011) — ✅ built
Built: `supabase/migrations/20261121_0011_staff_chat.sql`, rules summarised in `docs/ACCESS_RULES.md`. Group membership is computed live from roles, class teachers and access (no syncing triggers needed; a trigger only creates the group for a new class). The attachments table moved to step 4 with storage. Checked: 244/244 database checks (61 new), safe to run twice. Owner must run it on the real project.

Planned:
Tables: `conversations`, `conversation_members`, `messages`, `message_attachments`, `message_reports`, `admin_access_log`.
- RLS: a user sees a conversation and its messages only if they are a member **and** their staff access is on. Admin sees a non-member conversation only after it is reported, and only through a function that writes `admin_access_log`.
- Parents and students: no access at all.
- Functions: `start_direct_chat(other_user)`, `send_message(...)`, `delete_own_message(id)` (15-minute rule in the database), `mark_read(conversation)`, `report_message(id, reason)`, `admin_open_reported(report_id)`.
- Automatic groups: triggers keep membership in step with roles, class teachers and switched-off access (switched off = removed from every group at once).
- Tests: SQL isolation checks in `tests/sql/` (teacher can't read another class group, switched-off staff lose access, parent sees nothing, admin can't read unreported chats, every admin view is logged).

### Step 3. Chat screens — ✅ built
Built: `src/live/LiveMessages.tsx` (list, chat, new chat, members, report, admin Reported messages), `src/live/useChat.ts` (list + unread, Realtime with a 60-second backstop), `src/live/chat.mjs` (unit-tested rules), Messages tab with unread badge for admin, teacher and finance. Before migration 0011 the screen says chat is not switched on. Demo mode has no chat (it is the public preview with fictional data; left out on purpose). Live updates need the real project to check.

Planned:
- New **Messages** tab for staff: list of conversations (unread count, last message), chat view, new one-to-one chat (pick active staff).
- Live updates with Supabase Realtime; unread counts in the tab badge.
- Report message → admin's **Reports** list → open (logged) → mark handled.
- Demo mode: fictional chats so the public preview still works.
- Tests: unit tests for message formatting/validation, browser test with two staff in the fake database, axe.

### Step 4. Photos and files
- Private Supabase Storage bucket `chat-files`; storage policies match conversation membership; files opened through short-lived signed links.
- 10 MB limit and file-type allow list checked in the app **and** in the storage policy.
- Photos shrunk on the phone before upload; Drive links shown as a card (no Drive API needed).
- Tests: wrong type / too big refused, non-member can't fetch a file.

### Step 5. Phone alerts (web push)
- `push_subscriptions` table (migration 0012); "Turn on alerts" button.
- Supabase Edge Function `notify-message` sends Web Push (VAPID keys stored as Supabase secrets) to the other members; alert shows the sender and "New message", **not** the message text (privacy on lock screens).
- Removes dead subscriptions; unread counts stay the backstop.
- Owner setup: create VAPID keys, deploy the function (instructions in a new `docs/PUSH_ALERTS.md`).
- Tests: function unit test with a fake push service; manual check on one Android and one iPhone (home-screen install, iOS 16.4+).

### Step 6. Error reports (Sentry)
- `@sentry/react` with the DSN in `.env`; no session replay, no personal data sent; message text never logged.
- "Report a problem" in Settings. CSP updated for Sentry's host.

### Step 7. Keeping and clean-up
- Scheduled job (pg_cron or a scheduled Edge Function) removes messages and files older than one school year; storage use shown to the admin.

### Step 8. Privacy and policy
- Use the owner's Privacy Policy and Terms prompts (`Legal_Pages_Prompts.docx`) against the real code to draft an internal staff privacy notice and chat rules (who can read what, reporting, retention). Add to `docs/PRIVACY_LEGAL_RELEASE_CHECKLIST.md`. Needs sign-off by someone senior.

### Step 9. Switch-over
- Pilot with 3–5 staff for one week, then a fixed date when staff WhatsApp groups stop being used for school work.

## Workflow (from the video, adapted)
Plan file (this one) → picture mock-ups of the Messages screens in the Hub's colours (`docs/DESIGN_SPEC.md`) → build one step at a time → compare screenshots at phone width → pull request + review → owner runs the migration.
Add an `AGENTS.md`/`CLAUDE.md` with standing rules (never send messages automatically, RLS for every new table, test data only, no model names in commits).

## Risks
1. iPhone alerts need the Hub added to the home screen; some staff won't, and may stay on WhatsApp.
2. Switching staff over is a people problem: needs a date set by the school.
3. Privacy/safeguarding policy must be signed off before real use.
4. Photos may fill the free 1 GB; watch storage.
5. Some wide admin tables need a phone redesign (step 1).
6. Realtime and push can't be fully tested from the cloud session; they need a check on real phones.
