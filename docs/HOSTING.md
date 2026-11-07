# Putting the Academy Hub online

Until the app is hosted, it only runs on the computer where `npm run dev` is running, so teachers cannot use it from their own devices and Supabase invitation links cannot work. Hosting it gives it a fixed web address.

The repository is ready for **Netlify** (`netlify.toml`) and also works on **Cloudflare Pages**. Both have free plans for a small static site like this; check their current terms before signing up. Hosting only serves the app's files; the data stays in Supabase.

Security headers (`public/_headers`) are published with the app: a strict Content Security Policy (the page may only load its own files and talk to `*.supabase.co`), no embedding in other sites, no camera/microphone/location. Tested: all live and demo screens work under these rules.

## Netlify (about 15 minutes)
1. Sign in at netlify.com with GitHub (the account that owns `booksbigchange-rgb/Bigchange_Academy_Hub`).
2. **Add new site → Import an existing project → GitHub →** choose `Bigchange_Academy_Hub`.
3. **Branch to deploy:** `ccr-7b420966-pk4uiw` (or `main` once the work is merged). Build settings are read from `netlify.toml`; leave them.
4. **Environment variables** (Site configuration → Environment variables), add exactly two:
   - `VITE_ACADEMY_SUPABASE_URL` = `https://txwremmzgnmlnklpeton.supabase.co`
   - `VITE_ACADEMY_SUPABASE_PUBLISHABLE_KEY` = your `sb_publishable_…` key
   Never add a secret/service-role key or database password.
5. **Deploy.** Netlify gives an address like `https://something.netlify.app` (you can rename it, or attach your own domain later).
6. Open the address: you should see the **Academy sign in** page (not the demo). Sign in as admin to confirm.

## Then, in Supabase
1. **Authentication → URL Configuration:**
   - **Site URL** = your new address, e.g. `https://bigchange-academy.netlify.app`
   - **Redirect URLs:** add the same address (and `http://127.0.0.1:5173` if you still test locally).
2. **Authentication → Sign In / Providers:** make sure **Allow new users to sign up** is **off**.
3. Now invitations work: **Authentication → Users → Invite user**. The person opens the email, lands on "Complete your invitation", and sets their own password. Then give them a role with `supabase/manual/provision_staff.sql` (staff) or `link_login.sql` (parents/students).

## Before real families use it
Complete `docs/PRIVACY_LEGAL_RELEASE_CHECKLIST.md`. Until then, keep using test data.

## Cloudflare Pages instead
Create a Pages project from the same GitHub repository; build command `npm run build`, output directory `dist`, environment variable `NODE_VERSION=22` plus the two `VITE_ACADEMY_…` values. `public/_headers` is applied automatically. Then do the Supabase steps above.
