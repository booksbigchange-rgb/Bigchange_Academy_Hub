/**
 * Parent payment periods. School policy (from the owner): each parent pays once per 3-month period for all of their
 * children's courses: USD 150 if the family has one course in total, otherwise USD 100 per course. The amount is
 * computed by the database (academy_family_fee); these constants are only for explanatory text.
 * Payments happen outside the app; the app only tracks who reported, checked and approved them.
 */
export const FEE_TEXT = Object.freeze({ single: 150, multi: 100, currency: 'USD' });
export const METHODS = Object.freeze([['cash', 'Cash'], ['bank', 'Bank'], ['mobile_money', 'Mobile money'], ['other', 'Other']]);
export const STATUS_LABEL = Object.freeze({ paid: 'Paid', partial: 'Partly paid', unpaid: 'Unpaid', overdue: 'Overdue' });
export const STAGE_LABEL = Object.freeze({ none: 'Nothing reported', reported: 'Reported, awaiting finance check', checked: 'Checked, awaiting admin approval', approved: 'Approved' });

/** '2026-08-10' -> '10/08/2026' (day first, as the school writes dates). */
export function formatDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso || '')) return '—';
  return iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
}
export const todayIso = (now = new Date()) =>
  now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
export const usd = n => 'USD ' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Plain-text reminder for staff to send themselves; this app never sends messages. */
export function reminderText({ guardian, students, amount, start, end }) {
  const who = students.length ? students.join(', ') : 'your child';
  return `Dear ${guardian}, this is a reminder from BigChange Academy that the payment of ${usd(amount)} for ${who} for the period ${formatDate(start)} to ${formatDate(end)} is still outstanding. Payments are made outside this system. Please contact the school office if you have already paid.`;
}

/** WhatsApp "click to chat" link with the message filled in, or null without a usable number. Nothing is sent automatically. */
export function whatsappLink(phoneE164, text) {
  const digits = typeof phoneE164 === 'string' ? phoneE164.replace(/\D/g, '') : '';
  if (digits.length < 8) return null;
  return 'https://wa.me/' + digits + '?text=' + encodeURIComponent(text);
}
/** A reminder makes sense once the family's 3 months have ended and the payment is not approved as paid. */
export const needsReminder = (p, today = todayIso()) => p.status !== 'paid' && p.period_end <= today;
/** Short "last reminded" text, e.g. "Reminded 09/11/2026" or "Not reminded yet". */
export const remindedText = iso => (iso ? 'Reminded ' + formatDate(String(iso).slice(0, 10)) : 'Not reminded yet');

/** Add whole days to a 'YYYY-MM-DD' date (calendar days, no time-zone drift). */
export function addDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}
/** Guess the next level's name from a class name like "English – Level 2" → "English – Level 3". */
export function nextLevelName(classTitle) {
  const m = /^(.*?level\s*)(\d+)(.*)$/i.exec(classTitle || '');
  return m ? m[1] + (Number(m[2]) + 1) + m[3] : '';
}
/** Notice to parents that a level is ending, with the one-week break and the next start date. */
export function levelEndNotice({ classTitle, endDate, nextStart, nextLevel }) {
  const next = nextLevel ? ` The next level (${nextLevel}) starts on ${formatDate(nextStart)}.` : ` The next level starts on ${formatDate(nextStart)}.`;
  return `Dear parents, ${classTitle} finishes on ${formatDate(endDate)}. After that there is a one-week break.${next} Thank you, BigChange Academy.`;
}
/** WhatsApp share link without a number: WhatsApp asks which chat or group to send it to. */
export const shareToWhatsApp = text => 'https://wa.me/?text=' + encodeURIComponent(text);
/** General reminder used for bulk email (everyone gets the same text; amounts are in each family's own record). */
export const bulkReminderText = () => 'Dear parent, this is a reminder from BigChange Academy that a payment for your child\'s classes is outstanding. Payments are made directly to the school. If you have already paid, please let us know so we can update our records. Thank you.';
/**
 * Free bulk email: opens the staff member's own email app with parents in BCC (they cannot see each other).
 * Split into groups so the link is not too long for email apps.
 * @param {string[]} emails
 * @param {{subject?: string, body?: string, size?: number}} [options]
 * @returns {Array<{emails: string[], href: string}>}
 */
export function emailBatches(emails, { subject, body, size = 40 } = {}) {
  const list = [...new Set(emails.filter(e => typeof e === 'string' && e.includes('@')))];
  const out = [];
  for (let i = 0; i < list.length; i += size) {
    const group = list.slice(i, i + size);
    out.push({ emails: group, href: 'mailto:?bcc=' + group.map(encodeURIComponent).join(',') + '&subject=' + encodeURIComponent(subject ?? '') + '&body=' + encodeURIComponent(body ?? '') });
  }
  return out;
}
