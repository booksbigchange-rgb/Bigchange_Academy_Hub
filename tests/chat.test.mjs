import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMessage, canDelete, linkLabel, chatTime, totalUnread, conversationKind } from '../src/live/chat.mjs';

test('messages are trimmed and need text or a link', () => {
  assert.deepEqual(validateMessage('  hello  ', ''), { p_body: 'hello', p_link: null });
  assert.deepEqual(validateMessage('', ' https://drive.google.com/x '), { p_body: null, p_link: 'https://drive.google.com/x' });
  assert.throws(() => validateMessage('   ', ''), /Write a message/);
  assert.throws(() => validateMessage('x'.repeat(4001), ''), /too long/);
  assert.doesNotThrow(() => validateMessage('x'.repeat(4000), ''));
});
test('links must be https', () => {
  assert.throws(() => validateMessage('', 'http://example.com'), /https/);
  assert.throws(() => validateMessage('', 'javascript:alert(1)'), /https/);
  assert.throws(() => validateMessage('', 'https://exa mple.com'), /https/);
});
test('own messages can be deleted for 15 minutes', () => {
  const now = Date.parse('2026-11-21T10:00:00Z');
  const m = { sender_staff_id: 'me', created_at: '2026-11-21T09:50:00Z', deleted_at: null };
  assert.equal(canDelete(m, 'me', now), true);
  assert.equal(canDelete(m, 'someone else', now), false);
  assert.equal(canDelete({ ...m, created_at: '2026-11-21T09:44:00Z' }, 'me', now), false);
  assert.equal(canDelete({ ...m, deleted_at: '2026-11-21T09:55:00Z' }, 'me', now), false);
});
test('link labels', () => {
  assert.equal(linkLabel('https://drive.google.com/file/d/1/view'), 'Google Drive file');
  assert.equal(linkLabel('https://docs.google.com/spreadsheets/d/1/edit'), 'Google Sheet');
  assert.equal(linkLabel('https://docs.google.com/document/d/1/edit'), 'Google Doc');
  assert.equal(linkLabel('https://www.example.org/a'), 'example.org');
  assert.equal(linkLabel('not a url'), 'Link');
});
test('chat times', () => {
  const now = new Date(2026, 10, 21, 15, 0);
  assert.match(chatTime(new Date(2026, 10, 21, 9, 5).toISOString(), now), /^09:05$/);
  assert.equal(chatTime(new Date(2026, 10, 20, 9, 5).toISOString(), now), 'Yesterday');
  assert.equal(chatTime(new Date(2026, 9, 3, 9, 5).toISOString(), now), '3 Oct');
  assert.equal(chatTime(null, now), '');
});
test('unread total and kinds', () => {
  assert.equal(totalUnread([{ unread: 2 }, { unread: 0 }, { unread: 3 }]), 5);
  assert.equal(totalUnread(null), 0);
  assert.equal(conversationKind({ kind: 'direct' }), 'One-to-one');
  assert.equal(conversationKind({ kind: 'group', class_id: 'x' }), 'Class group');
  assert.equal(conversationKind({ kind: 'group', group_key: 'all_staff' }), 'Group');
});
