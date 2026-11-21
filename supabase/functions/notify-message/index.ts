// Supabase Edge Function: sends phone alerts for a new chat message. Deploy steps: docs/PUSH_ALERTS.md.
// Secrets (Supabase → Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:office@your-school).
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import webpush from 'npm:web-push@3.6.7';
import { notifyMessage } from './core.mjs';

const url = Deno.env.get('SUPABASE_URL')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:office@example.org', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return Response.json({ error: 'sign in first' }, { status: 401, headers: cors });
  // As the signed-in sender: the database decides whether this message may be alerted (sender, 2 minutes, once).
  const asUser = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { message_id: messageId } = await req.json().catch(() => ({}));
  const result = await notifyMessage({
    messageId,
    claim: async id => { const { data, error } = await asUser.rpc('academy_chat_claim_push', { p_message: id }); if (error) throw error; return data === true; },
    targets: async id => { const { data, error } = await service.rpc('academy_chat_push_targets', { p_message: id }); if (error) throw error; return data ?? []; },
    send: (subscription, payload) => webpush.sendNotification(subscription, payload, { TTL: 60 * 60 * 24, urgency: 'high' }),
    removeDead: async ids => { await service.rpc('academy_push_remove_dead', { p_ids: ids }); },
  });
  return Response.json(result.body, { status: result.status, headers: cors });
});
