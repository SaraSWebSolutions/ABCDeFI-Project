import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveR3TestAuthenticationEnabled } from '../src/Config/r3TestAuthMode.mjs';

test('browser R3 fixture needs an explicit build flag, development server, and R3 family', () => {
  assert.equal(resolveR3TestAuthenticationEnabled({ requested: 'enabled', isDevelopmentServer: true, runtimeFamily: '1Q_LOCAL_R3_TEST' }), true);
  for (const input of [
    { requested: undefined, isDevelopmentServer: true, runtimeFamily: '1Q_LOCAL_R3_TEST' },
    { requested: 'enabled', isDevelopmentServer: false, runtimeFamily: '1Q_LOCAL_R3_TEST' },
    { requested: 'enabled', isDevelopmentServer: true, runtimeFamily: '1Q_LOCAL' },
    { requested: 'enabled', isDevelopmentServer: true, runtimeFamily: '1Q_BSC_TESTNET' },
  ]) assert.equal(resolveR3TestAuthenticationEnabled(input), false);
});
