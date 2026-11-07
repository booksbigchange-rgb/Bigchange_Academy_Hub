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
