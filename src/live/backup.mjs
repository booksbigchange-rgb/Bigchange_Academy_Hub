// Backup download: every table the admin's app has loaded, one CSV per table, plus a read-me, in one ZIP.
import { toCsv } from './fees.mjs';
import { makeZip } from './zip.mjs';

const TABLES = [
  ['students.csv', 'learners', 'Students'], ['parents.csv', 'guardians', 'Parents (guardians) and their contact permissions'],
  ['parent_links.csv', 'links', 'Which parent belongs to which student, and whether an admin verified it'],
  ['courses.csv', 'courses', 'Courses'], ['classes.csv', 'classes', 'Classes, their teacher and level dates'],
  ['enrollments.csv', 'enrollments', 'Which student is in which class'], ['lessons.csv', 'sessions', 'Lessons (date and time)'],
  ['attendance.csv', 'attendance', 'Attendance marks per lesson and student'],
  ['payment_periods.csv', 'periods', 'Every 3-month payment period with its report, check, approval and status'],
  ['reminders.csv', 'reminders', 'When payment reminders were sent'], ['payment_methods.csv', 'paymentMethods', 'Payment methods'],
  ['staff.csv', 'staff', 'Staff and their roles'],
];

/** Rows → CSV with every column that appears in any row (first row's order first). Objects become JSON. */
export function tableCsv(rows) {
  const cols = [];
  for (const r of rows) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k);
  const cell = v => (v !== null && typeof v === 'object' ? JSON.stringify(v) : v);
  return toCsv(cols, rows.map(r => cols.map(c => cell(r[c]))));
}

/** The files of the backup: one CSV per table and README.txt (with the counts). */
export function backupFiles(data, now = new Date()) {
  const stamp = now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const files = TABLES.map(([name, key]) => ({ name, text: tableCsv(data[key] ?? []) }));
  const lines = TABLES.map(([name, key, what]) => `${name.padEnd(22)} ${String((data[key] ?? []).length).padStart(6)} rows  ${what}`);
  files.unshift({ name: 'README.txt', text: [
    'BigChange Academy Hub - data backup',
    `Made: ${stamp}`,
    '',
    'Each .csv file opens in Google Sheets or Excel. Every row keeps its id, so records can be matched across files',
    '(for example attendance.csv -> lessons.csv -> classes.csv).',
    'Cells that start with = + - or @ have a leading apostrophe so spreadsheets show them as text (e.g. phone numbers).',
    '',
    ...lines,
    '',
    'Not included: login accounts and passwords (those stay in Supabase Authentication) and the activity log.',
    'This file contains parents\' names, phone numbers and email addresses: keep it private (school computer or',
    'the school\'s Google Drive), never on a personal phone. Delete old copies you no longer need.',
    'For a complete database copy, also follow docs/BACKUPS.md.',
  ].join('\r\n') + '\r\n' });
  return files;
}

/** The backup as ZIP bytes, and its file name. */
export function backupZip(data, now = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  const name = `bigchange-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.zip`;
  return { name, bytes: makeZip(backupFiles(data, now), now) };
}
