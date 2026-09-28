/*
 * Loads the backend's local configuration for explicitly local operator
 * utilities. dotenv never overrides process-scoped values, so CI and an
 * operator can still supply a deliberate local database or development gate.
 */
const path = require('node:path');
const dotenv = require('dotenv');

function loadLocalDevelopmentEnv(env = process.env) {
  return dotenv.config({
    path: path.resolve(__dirname, '..', '.env'),
    processEnv: env,
    override: false,
  });
}

module.exports = { loadLocalDevelopmentEnv };
