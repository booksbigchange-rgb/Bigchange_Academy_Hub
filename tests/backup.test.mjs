import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32, makeZip, readZip } from '../src/live/zip.mjs';
import { backupFiles, backupZip, tableCsv } from '../src/live/backup.mjs';

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});
test('makeZip: files read back intact, including non-English names and text', () => {
  const zip = makeZip([{ name: 'a.csv', text: 'x,y\r\n1,2\r\n' }, { name: 'ትግርኛ.txt', text: 'ሰላም' }], new Date(2026, 10, 25, 9, 30));
  assert.deepEqual([...zip.subarray(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  assert.deepEqual(readZip(zip), [{ name: 'a.csv', text: 'x,y\r\n1,2\r\n', crcOk: true }, { name: 'ትግርኛ.txt', text: 'ሰላም', crcOk: true }]);
  const end = new DataView(zip.buffer).getUint32(zip.length - 22, true);
  assert.equal(end, 0x06054b50);
});
test('tableCsv: union of columns, objects as JSON, phone kept as text', () => {
  assert.equal(tableCsv([{ id: 1, phone_e164: '+251911000000' }, { id: 2, extra: { a: 1 } }]),
    '﻿"id","phone_e164","extra"\r\n"1","\'+251911000000",""\r\n"2","","{""a"":1}"\r\n');
});
test('backupFiles: a read-me with counts and one CSV per table; ZIP name has the date', () => {
  const data = { learners: [{ id: 'a', display_name: 'Abel', active: true }], guardians: [], links: [], courses: [], classes: [], enrollments: [],
    sessions: [], attendance: [], periods: [], reminders: [], paymentMethods: [], staff: [{ id: 's', role: 'admin', display_name: 'Admin' }] };
  const files = backupFiles(data, new Date(Date.UTC(2026, 10, 25, 8, 0)));
  assert.equal(files[0].name, 'README.txt');
  assert.match(files[0].text, /students\.csv\s+1 rows/);
  assert.match(files[0].text, /Not included: login accounts/);
  assert.deepEqual(files.map(f => f.name).slice(1, 4), ['students.csv', 'parents.csv', 'parent_links.csv']);
  assert.equal(files.length, 13);
  assert.match(files.find(f => f.name === 'students.csv').text, /"Abel"/);
  const { name, bytes } = backupZip(data, new Date(2026, 10, 25, 8));
  assert.equal(name, 'bigchange-backup-2026-11-25.zip');
  assert.equal(readZip(bytes).length, 13);
});
