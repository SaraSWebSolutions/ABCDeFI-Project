/* Explicit B6.4 checkpoint binding.  No caller may fall back to the default DB. */
const mongoose = require('mongoose');
const { ONE_Q_LOCAL_B64_LIFECYCLE_TEST, B64_RUN_ID, B64_CHECKPOINT_NAMESPACE, configuredB64CheckpointMongoUri } = require('./oneQLocalB64LifecycleTestRuntime.cjs');
const projectionModels = require('../modules/lendingV2Projection/models.cjs');
function fail(message) { throw new Error(`B6.4 checkpoint binding rejected: ${message}`); }
function createB64CheckpointModels({ runtime, environment = process.env, createConnection = (uri) => mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 }) } = {}) {
  if (!runtime || runtime.family !== ONE_Q_LOCAL_B64_LIFECYCLE_TEST || runtime.runId !== B64_RUN_ID || runtime.checkpointNamespace !== B64_CHECKPOINT_NAMESPACE) fail('runtime family, run, or checkpoint namespace is invalid.');
  const uri = configuredB64CheckpointMongoUri(environment);
  const connection = createConnection(uri);
  if (!connection || typeof connection.model !== 'function' || !connection.models) fail('checkpoint connection is unavailable.');
  const models = projectionModels.createProjectionModels({ checkpointConnection: connection });
  if (!models.V2BlockCheckpoint || models.V2BlockCheckpoint === projectionModels.V2BlockCheckpoint) fail('default checkpoint model fallback is forbidden.');
  Object.defineProperty(models.V2BlockCheckpoint, '__abcdefiB64CheckpointNamespace', { value: B64_CHECKPOINT_NAMESPACE, configurable: false });
  return Object.freeze({ uri, connection, models });
}
module.exports = { createB64CheckpointModels };
