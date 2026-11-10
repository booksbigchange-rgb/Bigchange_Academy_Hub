# Weekly backup and a second admin

## Weekly backup (free, about 2 minutes)
The free Supabase plan keeps only a few days of its own copies, so the school keeps its own weekly copy.

On the school computer, in the project folder (`D:\Codex\Academy_Hub_Live`):
```
git pull
set ADMIN_EMAIL=your-admin-email&& set ADMIN_PASSWORD=your-admin-password
node scripts/backup.mjs
```
- It signs in as an admin and saves every Academy table into **`backups\academy-backup-YYYY-MM-DD.json`**, printing how many rows each table has.
- Close the window afterwards (the password was typed into it).
- **Keep the file safe:** it contains families' names and phone numbers. Keep it on the school computer or a school-only drive (for example a school Google Drive folder), never on a personal phone, never in GitHub (the `backups/` folder is already excluded from GitHub), never sent over WhatsApp.
- Keep the last few weeks; delete older copies.
- Logins (emails and passwords) are kept by Supabase and are not in the file. Restoring from a backup is a developer job; the file has everything needed.

Choose one person to do this every week (for example every Friday).

## A second admin
So the school is not locked out if one person loses their phone or password:
1. Supabase → **Authentication → Users → Add user → Create new user** with the second person's email, a password of 12+ characters, tick **Auto Confirm User**. Give them the password in person.
2. SQL Editor → new query → paste `supabase/manual/provision_test_admin.sql`, change **only** the email on the `target_email` line (leave the placeholder in the `IF` line), **Run**. Expect "admin profile is provisioned".
3. The second admin signs in once to check it works.

Also give the second admin access to the Supabase dashboard (Supabase → Organization → Team → Invite) so they can manage logins if needed.
