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

// ---- Files (migration 0012) ----
export const MAX_FILE = 10 * 1024 * 1024;
/** File types staff may send. Matches the storage bucket and the database. */
export const FILE_TYPES = {
  'application/pdf': 'PDF', 'text/csv': 'CSV', 'text/plain': 'Text',
  'application/msword': 'Word', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.ms-excel': 'Excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  'application/vnd.ms-powerpoint': 'PowerPoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
  'image/jpeg': 'Photo', 'image/png': 'Photo', 'image/webp': 'Photo', 'image/heic': 'Photo'
};
const BY_EXTENSION = { pdf: 'application/pdf', csv: 'text/csv', txt: 'text/plain', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  png: 'image/png', webp: 'image/webp', heic: 'image/heic' };
/** For the file picker's accept attribute. */
export const FILE_ACCEPT = Object.keys(BY_EXTENSION).map(e => '.' + e).join(',') + ',' + Object.keys(FILE_TYPES).join(',');

/** The file's real type: some phones report an empty or generic type, so fall back to the extension. */
export function fileType(file) {
  const t = String(file?.type ?? '').toLowerCase();
  if (FILE_TYPES[t]) return t;
  const ext = String(file?.name ?? '').toLowerCase().split('.').pop();
  return BY_EXTENSION[ext] ?? t;
}

/** Throws a readable error when the file cannot be sent. */
export function validateFile(file) {
  if (!file) throw Error('Choose a file');
  if (!FILE_TYPES[fileType(file)]) throw Error('This kind of file cannot be sent. Use PDF, Word, Excel, PowerPoint, CSV or a photo.');
  if (!(file.size > 0)) throw Error('This file is empty');
  if (file.size > MAX_FILE) throw Error('Files can be at most 10 MB');
  return fileType(file);
}

/** A storage-safe file name: letters, digits, dot, dash, underscore; keeps the extension; at most 100 characters. */
export function safeFileName(name) {
  const raw = String(name ?? '').normalize('NFKD').replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_');
  const dot = raw.lastIndexOf('.');
  const ext = dot >= 0 && /^\.[A-Za-z0-9]{1,9}$/.test(raw.slice(dot)) ? raw.slice(dot) : '';
  const stem = (ext ? raw.slice(0, dot) : raw).replace(/^[._\-]+|[._\-]+$/g, '').replace(/\.{2,}/g, '.');
  return (stem.slice(0, 100 - ext.length) || 'file') + ext;
}

/** chat-files/<conversation>/<random id>/<safe name>, the layout the storage rules expect. */
export function storagePath(conversationId, randomId, name) {
  return `${conversationId}/${randomId}/${safeFileName(name)}`;
}

export function isPhoto(type) { return String(type).startsWith('image/'); }
/** Photos the browser can redraw smaller (HEIC cannot be read by most browsers, so it is sent as it is). */
export function canShrink(type) { return ['image/jpeg', 'image/png', 'image/webp'].includes(type); }

export function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
  return (n / 1024 / 1024).toFixed(1).replace(/\.0$/, '') + ' MB';
}
