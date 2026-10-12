const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const { createB64CheckpointModels } = require('../config/b64CheckpointModels.cjs');
const runtime = require('../config/oneQLocalB64LifecycleTestRuntime.cjs');
const env = { ABCDEFI_B64_CHECKPOINT_MONGODB_URI: `mongodb://127.0.0.1:27017/${runtime.B64_CHECKPOINT_NAMESPACE}` };
const goodRuntime = { family: runtime.ONE_Q_LOCAL_B64_LIFECYCLE_TEST, runId: runtime.B64_RUN_ID, checkpointNamespace: runtime.B64_CHECKPOINT_NAMESPACE };
function connection() { const c = mongoose.createConnection(); return c; }
test('B6.4 checkpoint writer and reader receive a non-default exact-namespace model', () => {
  const value = createB64CheckpointModels({ runtime: goodRuntime, environment: env, createConnection: connection });
  assert.equal(value.models.V2BlockCheckpoint.__abcdefiB64CheckpointNamespace, runtime.B64_CHECKPOINT_NAMESPACE);
  assert.notEqual(value.models.V2BlockCheckpoint, require('../modules/lendingV2Projection/models.cjs').V2BlockCheckpoint);
  value.connection.destroy();
});
for (const [name, options] of [
  ['missing URI', { environment: {} }],
  ['wrong namespace', { environment: { ABCDEFI_B64_CHECKPOINT_MONGODB_URI: 'mongodb://127.0.0.1:27017/other' } }],
  ['wrong runtime', { runtime: { ...goodRuntime, family: '1Q_LOCAL_R3_TEST' } }],
  ['unavailable model', { createConnection: () => null }],
]) test(`B6.4 checkpoint binding rejects ${name}`, () => {
  assert.throws(() => createB64CheckpointModels({ runtime: goodRuntime, environment: env, createConnection: connection, ...options }), /rejected/);
});
