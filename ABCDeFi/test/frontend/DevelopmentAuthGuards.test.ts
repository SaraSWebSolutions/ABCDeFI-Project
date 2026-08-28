import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveFrontendAuthMode, walletAuthenticationNeedsInvalidation } from '../../src/Config/auth';

test('development authentication requires an explicit development browser build', () => {
  assert.equal(resolveFrontendAuthMode('development', true), 'development');
  assert.equal(resolveFrontendAuthMode('development', false), 'production');
  assert.equal(resolveFrontendAuthMode(undefined, true), 'production');
});

test('wallet sessions are invalidated on account switch, disconnect, and wrong network', () => {
  const accountOne = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  const accountTwo = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  assert.equal(walletAuthenticationNeedsInvalidation(accountOne, accountOne.toLowerCase(), true), false);
  assert.equal(walletAuthenticationNeedsInvalidation(accountOne, accountTwo, true), true);
  assert.equal(walletAuthenticationNeedsInvalidation(accountOne, null, true), true);
  assert.equal(walletAuthenticationNeedsInvalidation(accountOne, accountOne, false), true);
});
