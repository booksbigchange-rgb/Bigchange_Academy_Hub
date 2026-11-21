/** Staff chat helpers (pure, unit-tested). The database enforces the same rules (migration 0011). */
export const MAX_MESSAGE = 4000;
export const DELETE_WINDOW_MS = 15 * 60 * 1000;

/** Clean a message before sending. Throws a readable error when it cannot be sent. */
export function validateMessage(body, link) {
  const text = String(body ?? '').trim();
  const url = String(link ?? '').trim();
  if (!text && !url) throw Error('Write a message');
  if (text.length > MAX_MESSAGE) throw Error('Message is too long (4,000 characters at most)');
  if (url && (!/^https:\/\/\S+$/.test(url) || url.length > 2000)) throw Error('Links must start with https://');
  return { p_body: text || null, p_link: url || null };
}

/** Own message, not deleted, younger than 15 minutes. (A reported message is refused by the database.) */
export function canDelete(message, myStaffId, now = Date.now()) {
  return !!message && !message.deleted_at && message.sender_staff_id === myStaffId
    && now - new Date(message.created_at).getTime() <= DELETE_WINDOW_MS;
}

/** A short label for a shared link: Google Drive files get a friendly name. */
export function linkLabel(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'drive.google.com') return 'Google Drive file';
    if (u.hostname === 'docs.google.com') {
      if (u.pathname.startsWith('/spreadsheets')) return 'Google Sheet';
      if (u.pathname.startsWith('/document')) return 'Google Doc';
      if (u.pathname.startsWith('/presentation')) return 'Google Slides';
      return 'Google Docs file';
    }
    return u.hostname.replace(/^www\./, '');
  } catch { return 'Link'; }
}

/** "14:05" today, "Yesterday", weekday within a week, otherwise "3 Nov". Times in the viewer's own clock. */
export function chatTime(iso, now = new Date()) {
  if (!iso) return '';
  const d = new Date(iso);
  const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  if (diff <= 0) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString('en-GB', { weekday: 'short' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function totalUnread(list) {
  return (list ?? []).reduce((n, c) => n + (Number(c.unread) || 0), 0);
}

/** Group label shown under a conversation title. */
export function conversationKind(c) {
  if (c.kind === 'direct') return 'One-to-one';
  if (c.class_id) return 'Class group';
  return 'Group';
}
