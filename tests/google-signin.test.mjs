import test from 'node:test';
import assert from 'node:assert/strict';
import { googleSignInMessage } from '../src/lib/googleSignIn.mjs';

test('Google sign-in errors get plain-language messages', () => {
  assert.equal(googleSignInMessage('', ''), '');
  assert.match(googleSignInMessage('access_denied', 'Signups not allowed for this instance'), /has not been added to the Academy/);
  assert.match(googleSignInMessage('server_error', 'Unable to exchange external code: 4/0Ab…'), /Client ID and Client Secret again/);
  assert.match(googleSignInMessage('validation_failed', 'Unsupported provider: provider is not enabled'), /switched off/);
  assert.match(googleSignInMessage('access_denied', 'The user denied access'), /cancelled/);
  assert.match(googleSignInMessage('server_error', 'Something new'), /did not complete/);
});
test('the raw error text is never shown', () => {
  assert.doesNotMatch(googleSignInMessage('server_error', 'Call +000 to fix your account'), /Call|\+000/);
});
