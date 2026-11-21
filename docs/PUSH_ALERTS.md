# Phone alerts for staff chat — owner setup

Staff get an alert on their phone when a colleague writes to them: **"New message from Teacher A in Teachers"**. The alert never contains the message itself. Tapping it opens that chat.

Until this setup is done, chat still works fully; the Messages screen just says "Phone alerts are not set up yet", and unread counts show in the app.

Do this **after** migrations 0011–0012 and after the Hub is online (`docs/HOSTING.md`). About 20 minutes, free.

## 1. Run migration 0013 (2 minutes)
Supabase → SQL Editor → paste `supabase/migrations/20261122_0013_push_alerts.sql` → **Run** → "Success". Then `supabase/checks/verify_academy_readonly.sql`: **25 tables, 54 policies**. Safe to run twice.

## 2. Make a key pair (on your computer, 2 minutes)
In a terminal (Node is already installed for this project):
```
npx web-push generate-vapid-keys
```
It prints a **Public Key** and a **Private Key**.
- The **public** key is not secret: it goes into Netlify (step 4).
- The **private** key is secret: it goes **only** into Supabase (step 3). Never into GitHub, `.env`, chat or email.

## 3. Put the secrets in Supabase (3 minutes)
Supabase → **Edge Functions → Secrets** → add:
| Name | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | the public key |
| `VAPID_PRIVATE_KEY` | the private key |
| `VAPID_SUBJECT` | `mailto:` + the school office email, e.g. `mailto:office@…` |

## 4. Deploy the function (5 minutes)
On your computer, in the project folder (`git pull` first):
```
npx supabase login
npx supabase functions deploy notify-message --project-ref txwremmzgnmlnklpeton
```
Keep **"Verify JWT"** switched on (the default): only signed-in staff can call it.

## 5. Tell the app the public key (3 minutes)
Netlify → Site configuration → **Environment variables** → add `VITE_ACADEMY_VAPID_PUBLIC_KEY` = the public key → **Deploys → Trigger deploy**.

## 6. Try it (two phones)
1. Each person opens the Hub. **iPhone:** first add it to the home screen (Share → Add to Home Screen) and open it from there — iPhones only allow alerts for installed web apps (iOS 16.4 or newer). **Android:** Chrome is enough; installing is still recommended.
2. Messages → **Turn on alerts** → allow.
3. Person A writes to person B. Person B's phone shows "New message from …" within a few seconds, even with the Hub closed. Tapping it opens the chat.

If no alert arrives: check the phone allows notifications for the Hub (phone settings), then Supabase → Edge Functions → notify-message → **Logs**.

## How it works (for whoever maintains it)
- `academy_push_subscriptions`: one row per device; staff see only their own. Signing out removes the device's address, so a shared phone stops getting the previous person's alerts.
- After sending, the app calls `notify-message` with the message id. The function asks the database, **as the sender**, `academy_chat_claim_push()` (only the sender, within 2 minutes, once per message), then with the service key reads `academy_chat_push_targets()` (other **active** members' devices) and sends the alerts with the VAPID keys. Addresses the push service reports as gone are removed.
- If the sender closes the app before the call, no alert goes out for that message; the unread count still shows when the others open the Hub.
- Code: `supabase/functions/notify-message/` (logic in `core.mjs`, unit-tested in `tests/notify-message.test.mjs`); alert display in `public/sw.js` (tested in `tests/push.test.mjs`).
