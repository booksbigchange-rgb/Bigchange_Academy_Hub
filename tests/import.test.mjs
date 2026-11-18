import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, matchColumns, planImport, MAX_IMPORT_ROWS, TEMPLATE_HEADER, TEMPLATE_EXAMPLE } from '../src/live/importCsv.mjs';
import { toCsv } from '../src/live/fees.mjs';

const existing = { learners: [{ display_name: 'Already Here' }], classes: [{ id: 'c1', title: 'English – Level 2' }, { id: 'c2', title: 'Computer – Canva' }] };

test('parseCsv: quotes, doubled quotes, CRLF, byte-order mark, empty lines', () => {
  const rows = parseCsv('﻿a,b,c\r\n"x, y","say ""hi""",z\r\n\r\n1,2,3');
  assert.deepEqual(rows, [['a', 'b', 'c'], ['x, y', 'say "hi"', 'z'], ['1', '2', '3']]);
});
test('parseCsv: semicolon and tab separators are detected', () => {
  assert.deepEqual(parseCsv('a;b\n1;2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv('a\tb\n1\t2'), [['a', 'b'], ['1', '2']]);
});
test('parseCsv: a line break inside quotes stays in the cell', () => {
  assert.deepEqual(parseCsv('a,b\n"line 1\nline 2",x'), [['a', 'b'], ['line 1\nline 2', 'x']]);
});
test('our own template round-trips through parseCsv', () => {
  assert.deepEqual(parseCsv(toCsv(TEMPLATE_HEADER, [TEMPLATE_EXAMPLE])), [TEMPLATE_HEADER, TEMPLATE_EXAMPLE]);
});
test('matchColumns: "Level start date" before "Level" is still not the level', () => {
  assert.deepEqual(matchColumns(['Level start date', 'Level']).columns, { level: 1 });
});
test('matchColumns: long Google Form headers; "Level start date" is not the level; teacher name is not the student', () => {
  const { columns, unknown } = matchColumns(['Timestamp', 'Teacher name', 'Student', 'Subject', 'Level', 'Level start date', 'Parent Name (must be paying parent)', 'Parent phone number (WhatsApp)']);
  assert.deepEqual(columns, { name: 2, subject: 3, level: 4, parentName: 6, phone: 7 });
  assert.deepEqual(unknown, ['Timestamp', 'Teacher name', 'Level start date']);
});
test('planImport: missing required columns are named', () => {
  assert.match(planImport([['Student', 'Grade'], ['A B', '5']], existing).error, /Parent name, Parent phone or Parent email/);
  assert.match(planImport([], existing).error, /empty/);
  assert.match(planImport([['Student', 'Parent', 'Phone']], existing).error, /no students/);
});
test('planImport: too many rows is refused', () => {
  const rows = [['Student', 'Parent', 'Phone'], ...Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => ['S ' + i, 'P P', '0911000000'])];
  assert.match(planImport(rows, existing).error, /At most 500/);
});
test('planImport: ready, skip and problem rows', () => {
  const rows = parseCsv([
    'Student name,Grade,Parent name,Parent phone,Parent email,WhatsApp OK,Email OK,Class',
    'New Kid,6,Mom One,0911 000 001,,yes,yes,english - level 2',   // ready; grade "6" -> Grade 6; email consent dropped (no email)
    'Already Here,,Mom Two,0911000002,,,,',                          // skip: already in the app
    'New Kid,,Mom One,0911000001,,,,',                                // skip: repeated row
    'X,,Mom,0911000003,,,,',                                          // problem: name too short
    'Kid Three,,Dad,,,,,',                                            // problem: no phone or email
    'Kid Four,,Dad Four,12345,,,,',                                   // problem: bad phone
    'Kid Five,,Dad Five,911000005,,,,French – Level 9',               // problem: class not found (phone without leading 0 is fixed)
    "Kid Six,Grade 13,Dad Six,'+251911000006,,,,",                   // problem: bad grade
    "Kid Seven,,Dad Seven,'+251911000007,dad7@example.com,no,yes,Computer – Canva",
  ].join('\n'));
  const { items } = planImport(rows, existing);
  assert.deepEqual(items.map(i => i.status), ['ready', 'skip', 'skip', 'problem', 'problem', 'problem', 'problem', 'problem', 'ready']);
  assert.deepEqual(items.map(i => i.line), [2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const [a, , , , , , five, , seven] = items;
  assert.equal(a.grade, 'Grade 6'); assert.equal(a.parent.phone, '+251911000001'); assert.equal(a.classId, 'c1'); assert.equal(a.className, 'English – Level 2');
  assert.equal(a.parent.whatsappOptIn, true); assert.equal(a.parent.emailOptIn, false);
  assert.match(five.problem, /Class "French – Level 9" not found/);
  assert.equal(five.parent.phone, '+251911000005');
  assert.equal(seven.parent.phone, '+251911000007'); assert.equal(seven.parent.email, 'dad7@example.com');
  assert.equal(seven.parent.emailOptIn, true); assert.equal(seven.parent.whatsappOptIn, false); assert.equal(seven.classId, 'c2');
});
test('planImport: the old form layout builds the class from subject and level', () => {
  const { items } = planImport([['Student', 'Subject', 'Level', 'Parent name', 'Phone'], ['Kid A', 'English', '2', 'Parent A', '0911000010']], existing);
  assert.equal(items[0].status, 'ready'); assert.equal(items[0].classId, 'c1');
});
test('planImport: names with < or > are refused', () => {
  const { items } = planImport([['Student', 'Parent', 'Phone'], ['<b>Kid</b>', 'Parent', '0911000011']], existing);
  assert.equal(items[0].status, 'problem');
});
