import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [portal, dashboard, service, server] = await Promise.all([
  readFile('src/components/AdminPortalEngine.tsx', 'utf8'),
  readFile('src/components/CanonicalAdminDashboard.tsx', 'utf8'),
  readFile('src/Services/canonicalAdmin.ts', 'utf8'),
  readFile('backend/backend/server.js', 'utf8'),
]);

const activePortal = portal.split('const LegacyAdminPortalEngine')[0];
assert.match(activePortal, /CanonicalAdminDashboard/);
assert.match(dashboard, /Runtime identity:/);
assert.match(dashboard, /Indexer checkpoint:/);
assert.doesNotMatch(activePortal, /<ICOAdmin\s*\/>/);
assert.doesNotMatch(activePortal, /<AdminNftIssuance\s*\/>/);
assert.match(dashboard, /Canonical admin provenance/);
assert.match(dashboard, /never grants a blockchain role/);
assert.match(dashboard, /Emergency \{action\}/);
assert.match(dashboard, /Confirmed on chain — waiting for indexer/);
assert.match(service, /Authorization: `Bearer \$\{token\}`/);
assert.match(service, /getConnectedAdminRoleStatus/);
assert.match(service, /executeEmergencyPauseAction/);
assert.match(service, /The transaction receipt did not contain the expected canonical module event/);
assert.match(server, /\/api\/admin\/canonical/);
console.log('Canonical Admin UX guards: PASS');
