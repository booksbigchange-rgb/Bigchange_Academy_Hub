// Pure logic of the notify-message function, so it can be tested in Node without Deno or a network.
// Dependencies are passed in: claim (as the sender), targets (service), send (web push), removeDead (service).

/** @returns {Promise<{status: number, body: object}>} */
export async function notifyMessage({ messageId, claim, targets, send, removeDead }) {
  if (typeof messageId !== 'string' || !/^[0-9a-f-]{36}$/i.test(messageId)) return { status: 400, body: { error: 'message_id is required' } };
  let allowed;
  try { allowed = await claim(messageId); } catch { return { status: 401, body: { error: 'not allowed' } }; }
  if (!allowed) return { status: 200, body: { sent: 0, skipped: 'already alerted, too old, or not your message' } };
  const list = await targets(messageId);
  const dead = [];
  let sent = 0;
  await Promise.all(list.map(async t => {
    // Only the title, a short line and where to open: never the message text.
    const payload = JSON.stringify({ title: t.title, body: t.body, tag: 'chat-' + t.conversation_id, url: './?chat=' + t.conversation_id });
    try { await send({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth_secret } }, payload); sent++; }
    catch (error) {
      const code = Number(error?.statusCode);
      if (code === 404 || code === 410) dead.push(t.subscription_id);
    }
  }));
  if (dead.length) await removeDead(dead);
  return { status: 200, body: { sent, removed: dead.length } };
}
