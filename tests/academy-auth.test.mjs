import test from 'node:test';
import assert from 'node:assert/strict';
import { getAcademyConfig } from '../src/lib/academyConfig.mjs';

test('demo has no database URL or key', () => assert.equal(getAcademyConfig(undefined, undefined), null));
test('only dedicated HTTPS Supabase URL plus public key enables auth', () => {
  assert.deepEqual(getAcademyConfig('https://academy123.supabase.co', 'sb_publishable_example-123'), {
    url: 'https://academy123.supabase.co', publishableKey: 'sb_publishable_example-123'
  });
});
test('missing and unsafe settings fail closed', () => {
  for (const [url, key] of [
    ['https://abc.supabase.co', undefined],
    [undefined, 'sb_publishable_example'],
    ['http://abc.supabase.co', 'sb_publishable_abc'],
    ['https://evil.example.com', 'sb_publishable_abc'],
    ['https://abc.supabase.co', 'sb_secret_abc'],
    ['https://abc.supabase.co', 'service_role'],
    ['https://abc.supabase.co/abc', 'sb_publishable_abc']
  ]) assert.throws(() => getAcademyConfig(url, key));
});
