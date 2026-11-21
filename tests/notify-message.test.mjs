import test from 'node:test';
import assert from 'node:assert/strict';
import { notifyMessage } from '../supabase/functions/notify-message/core.mjs';

const ID = '11111111-1111-1111-1111-111111111111';
const target = (n, extra = {}) => ({ subscription_id: 'sub' + n, endpoint: 'https://push.example/' + n, p256dh: 'k', auth_secret: 'a', title: 'BigChange Academy', body: 'New message from Teacher A in Teachers', conversation_id: 'conv', ...extra });

test('sends to every target with a short payload and no message text', async () => {
  const sent = [];
  const r = await notifyMessage({ messageId: ID, claim: async () => true, targets: async () => [target(1), target(2)],
    send: async (s, p) => { sent.push([s, JSON.parse(p)]); }, removeDead: async () => assert.fail('nothing to remove') });
  assert.deepEqual(r, { status: 200, body: { sent: 2, removed: 0 } });
  assert.equal(sent[0][0].endpoint, 'https://push.example/1');
  assert.deepEqual(Object.keys(sent[0][1]).sort(), ['body', 'tag', 'title', 'url']);
  assert.equal(sent[0][1].url, './?chat=conv');
});
test('nothing is sent when the database refuses the claim', async () => {
  const r = await notifyMessage({ messageId: ID, claim: async () => false, targets: async () => assert.fail('no lookup'), send: async () => assert.fail('no send'), removeDead: async () => {} });
  assert.equal(r.body.sent, 0);
});
test('a bad sign-in is refused', async () => {
  const r = await notifyMessage({ messageId: ID, claim: async () => { throw Error('JWT expired'); }, targets: async () => [], send: async () => {}, removeDead: async () => {} });
  assert.equal(r.status, 401);
});
test('a missing or odd message id is refused', async () => {
  for (const id of [undefined, '', 'drop table', 42]) {
    const r = await notifyMessage({ messageId: id, claim: async () => assert.fail(), targets: async () => [], send: async () => {}, removeDead: async () => {} });
    assert.equal(r.status, 400);
  }
});
test('addresses the push service reports gone are removed; other errors are kept', async () => {
  let removed = [];
  const r = await notifyMessage({ messageId: ID, claim: async () => true, targets: async () => [target(1), target(2), target(3)],
    send: async s => { if (s.endpoint.endsWith('/1')) throw Object.assign(Error('gone'), { statusCode: 410 }); if (s.endpoint.endsWith('/2')) throw Object.assign(Error('busy'), { statusCode: 503 }); },
    removeDead: async ids => { removed = ids; } });
  assert.deepEqual(removed, ['sub1']);
  assert.deepEqual(r.body, { sent: 1, removed: 1 });
});
