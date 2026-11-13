# Google sign-in (free, about 20 minutes, once)

Staff can sign in with their Google (Gmail) account instead of a password. Email + password keeps working.
**Who gets in does not change:** only people the admin has added in Supabase can sign in (public sign-up is off), and their role still comes from `provision_staff.sql` / `provision_test_admin.sql`. The Google account's email must be the same email the admin added.

This is an internal staff tool first; parents and students do not need logins for now.

## 1. Google Cloud (free)
1. Go to https://console.cloud.google.com/ and sign in with the school's Google account. Create a project, e.g. "BigChange Academy".
2. **APIs & Services → OAuth consent screen:** User type **External**, app name "BigChange Academy", support email = the school's email. Scopes: leave the defaults (email, profile, openid). Add the staff emails as **test users** while testing, or publish the app when ready.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID:** type **Web application**.
   - **Authorized redirect URI:** `https://txwremmzgnmlnklpeton.supabase.co/auth/v1/callback`
4. Copy the **Client ID** and **Client secret**. The secret is private: paste it only into Supabase (next step), never into chat, GitHub or the app.

## 2. Supabase
1. **Authentication → Sign In / Providers → Google:** switch on, paste the Client ID and Client secret, Save.
2. **Authentication → URL Configuration:** Site URL = where the app runs (the hosted address once online; `http://127.0.0.1:5173` while testing on your computer). Add both under **Redirect URLs**.
3. Keep **Allow new users to sign up** **off**.

## 3. Add a staff member
1. **Authentication → Users → Add user** with their **Gmail address** (auto-confirm). A password is optional if they will only use Google.
2. Give them their role with `supabase/manual/provision_staff.sql` (teacher / finance) or `provision_test_admin.sql` (admin).
3. They open the app and press **Sign in with Google**. If their Google email was not added, the app says so instead of letting them in.

Note: Supabase links the Google login to the existing user with the same confirmed email. If a sign-in is refused for an added user, check the email is identical and confirmed.
