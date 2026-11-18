// Import students (and their parents) from a spreadsheet saved as CSV, e.g. the school's old Google Form sheet.
// Pure functions only: parseCsv reads the file, planImport checks every row against the same rules as the
// "Add a student" form and decides what would happen. Nothing is saved here.
import { GRADE_LEVELS, normalizePhone, validateGuardian, validateLearner } from './validation.mjs';

export const MAX_IMPORT_ROWS = 500;

/** Parse CSV text into rows of cells. Handles quotes, "" inside quotes, CRLF, a byte-order mark,
 * and comma, semicolon or tab separators (Excel uses ";" in some countries). Empty lines are dropped. */
export function parseCsv(text) {
  const src = String(text ?? '').replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const count = ch => (firstLine.match(new RegExp('\\' + ch, 'g')) ?? []).length;
  const sep = [',', ';', '\t'].reduce((best, ch) => (count(ch) > count(best) ? ch : best), ',');
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

// Column names we recognise (compared without case, punctuation or extra spaces). Checked in this order, so
// "parent phone" is found before the shorter "parent". A header also matches when it starts with a name,
// e.g. "Parent phone number (WhatsApp)". Consent columns are matched first. Grade, class, subject and level must match exactly, so that a column
// such as "Level start date" is not mistaken for the level.
const FIELDS = [
  // Consent first, so "Email OK" is never taken for the email address (or "WhatsApp OK" for the phone).
  ['whatsappOk', ['whatsapp ok', 'whatsapp permission', 'agreed to whatsapp', 'whatsapp consent']],
  ['emailOk', ['email ok', 'email permission', 'agreed to email', 'email consent']],
  ['phone', ['parent phone', 'parent phone number', 'phone', 'phone number', 'mobile', 'telephone', 'whatsapp number']],
  ['email', ['parent email', 'email', 'email address', 'e mail']],
  ['parentName', ['parent name', 'parent', 'guardian name', 'guardian', 'parent full name', 'mother or father']],
  ['name', ['student name', 'student', 'student full name', 'child name', 'child', 'name']],
  ['grade', ['grade', 'grade level', 'school grade'], true],
  ['className', ['class', 'class name'], true],
  ['subject', ['subject', 'course'], true],
  ['level', ['level', 'stage'], true],
];
const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Which column holds which field. Returns { columns: {field: index}, unknown: [header text] }. */
export function matchColumns(header) {
  const columns = {}; const unknown = [];
  header.forEach((h, i) => {
    const n = norm(h);
    const hit = FIELDS.find(([field, names, exact]) => !(field in columns) && names.some(a => n === a || (!exact && n.startsWith(a + ' '))));
    if (hit) columns[hit[0]] = i; else if (n) unknown.push(String(h).trim());
  });
  return { columns, unknown };
}

const YES = new Set(['yes', 'y', 'true', '1', 'x', 'ok', 'agreed', 'agree', '✓', '✔']);
const yes = v => YES.has(String(v ?? '').trim().toLowerCase());
/** Spreadsheet quirks: our own download prefixes "+…" with an apostrophe; sheets often drop a phone's leading 0. */
const cellText = v => String(v ?? '').trim().replace(/^'/, '');
function phoneOf(v) {
  const raw = cellText(v).replace(/[\s().-]/g, '');
  return /^[79]\d{8}$/.test(raw) ? '0' + raw : raw;
}
function gradeOf(v) {
  const t = cellText(v); if (!t) return '';
  const m = t.match(/^(?:grade|gr|g)?\s*\.?\s*(\d{1,2})$/i);
  const g = m ? 'Grade ' + Number(m[1]) : t;
  return GRADE_LEVELS.find(x => x.toLowerCase() === g.toLowerCase()) ?? g;
}
/** "English – Level 2", "english - level 2" and "English Level 2" are the same class. */
export const classKey = s => norm(s);
function classNameOf(cells, columns) {
  if ('className' in columns) return cellText(cells[columns.className]);
  const subject = 'subject' in columns ? cellText(cells[columns.subject]) : '';
  const level = 'level' in columns ? cellText(cells[columns.level]) : '';
  if (!subject) return '';
  if (!level) return subject;
  return subject + ' – ' + (/^\d+$/.test(level) ? 'Level ' + level : level);
}

/**
 * Check every row. `existing` = { learners: [{display_name}], classes: [{id,title}] }.
 * Returns { error } when the file cannot be used at all, else { columns, unknown, items } where each item is
 * { line, name, grade, parent: {name, phone, email, emailOptIn, whatsappOptIn}, className, classId, status, problem }.
 * status: 'ready' (will be imported), 'skip' (already in the app or repeated in the file), 'problem' (fix and re-upload).
 */
export function planImport(rows, existing) {
  if (!rows.length) return { error: 'The file is empty.' };
  const [header, ...body] = rows;
  const { columns, unknown } = matchColumns(header);
  const missing = [];
  if (!('name' in columns)) missing.push('Student name');
  if (!('parentName' in columns)) missing.push('Parent name');
  if (!('phone' in columns) && !('email' in columns)) missing.push('Parent phone or Parent email');
  if (missing.length) return { error: 'The first row must name the columns. Missing: ' + missing.join(', ') + '. Download the template to see the expected columns.' };
  if (!body.length) return { error: 'The file has column names but no students.' };
  if (body.length > MAX_IMPORT_ROWS) return { error: `At most ${MAX_IMPORT_ROWS} students per file. Split the sheet into smaller files.` };

  const known = new Set(existing.learners.map(l => norm(l.display_name)));
  const classes = new Map(existing.classes.map(c => [classKey(c.title), c]));
  const seen = new Set();
  const items = body.map((cells, i) => {
    const get = f => (f in columns ? cellText(cells[columns[f]]) : '');
    const item = {
      line: i + 2, name: get('name'), grade: gradeOf(get('grade')),
      parent: { name: get('parentName'), phone: 'phone' in columns ? phoneOf(cells[columns.phone]) : '', email: get('email'),
        emailOptIn: yes(get('emailOk')), whatsappOptIn: yes(get('whatsappOk')) },
      className: classNameOf(cells, columns), classId: '', status: 'ready', problem: '',
    };
    try {
      validateLearner({ name: item.name, gradeLevel: item.grade });
      // Consent is recorded only where the sheet says so, and only for a contact that exists.
      if (item.parent.emailOptIn && !item.parent.email) item.parent.emailOptIn = false;
      if (item.parent.whatsappOptIn && !item.parent.phone) item.parent.whatsappOptIn = false;
      const g = validateGuardian(item.parent);
      item.parent.phone = g.p_phone ?? ''; item.parent.email = g.p_email ?? '';
      if (item.className) {
        const cls = classes.get(classKey(item.className));
        if (!cls) throw Error(`Class "${item.className}" not found. Create it under Classes first, or leave the class empty.`);
        item.classId = cls.id; item.className = cls.title;
      }
    } catch (e) { item.status = 'problem'; item.problem = e instanceof Error ? e.message : String(e); return item; }
    const key = norm(item.name);
    if (known.has(key)) { item.status = 'skip'; item.problem = 'A student with this name is already in the app'; }
    else if (seen.has(key)) { item.status = 'skip'; item.problem = 'Repeated: this student is already on an earlier row'; }
    seen.add(key);
    return item;
  });
  return { columns, unknown, items };
}

/** Column names for the template download. */
export const TEMPLATE_HEADER = ['Student name', 'Grade', 'Parent name', 'Parent phone', 'Parent email', 'WhatsApp OK', 'Email OK', 'Class'];
export const TEMPLATE_EXAMPLE = ['Sample Student', 'Grade 6', 'Sample Parent', '0911000000', '', 'yes', 'no', 'English – Level 2'];
