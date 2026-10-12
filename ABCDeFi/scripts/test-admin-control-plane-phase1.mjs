import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [dashboard, service, users, config, routes] = await Promise.all([
  readFile('src/components/CanonicalAdminDashboard.tsx', 'utf8'),
  readFile('src/Services/canonicalAdmin.ts', 'utf8'),
  readFile('src/components/AdminUserManagement.tsx', 'utf8'),
  readFile('backend/backend/modules/admin/canonicalAdmin/canonicalAdmin.config.cjs', 'utf8'),
  readFile('backend/backend/modules/admin/canonicalAdmin/canonicalAdmin.routes.cjs', 'utf8'),
]);

assert.match(dashboard, /Unified Emergency Center/);
assert.match(dashboard, /Admin operation audit/);
assert.match(dashboard, /AdminUserManagement/);
assert.doesNotMatch(dashboard, /CanonicalFranchiseV2Admin/);
assert.match(service, /'PENDING' \| 'SUBMITTED' \| 'CONFIRMED' \| 'FAILED' \| 'REVERTED' \| 'STALE' \| 'UNAVAILABLE'/);
assert.match(service, /The transaction receipt did not contain the expected canonical module event/);
assert.match(service, /Canonical indexer did not observe the event within the bounded wait/);
assert.match(service, /function expectedEmergencyEvent\(moduleName: string, action: 'pause' \| 'unpause'\)/);
assert.match(service, /moduleName === 'Treasury'/);
assert.match(service, /contract\.interface\.parseLog\(log\)\?\.name === expectedEvent/);
assert.match(service, /event\.module === moduleName/);
assert.match(service, /event\.eventName === expectedEvent/);
assert.doesNotMatch(service, /new Set\(\['Paused', 'TreasuryPaused'\]\)/);
assert.match(service, /state: 'STALE'/);
assert.match(service, /'REVERTED'/);
assert.match(service, /'FAILED'/);
assert.match(service, /eventObserved/);
assert.match(service, /checkNetwork/);
assert.match(service, /does not currently hold the required on-chain emergency role/);
assert.match(service, /createCanonicalAdminAudit/);
assert.match(service, /updateCanonicalAdminAudit/);
assert.match(service, /PROVIDER_ACCOUNT_AVAILABLE/);
assert.match(service, /PROVIDER_ACCOUNT_UNAVAILABLE/);
assert.match(service, /accountMatch/);
assert.match(service, /writeEligible/);
assert.match(service, /sameAddress/);
assert.match(service, /requiredEmergencyRole/);
assert.doesNotMatch(service, /universal Admin blockchain role/i);
assert.match(config, /ABCDTokenV2/);
assert.match(config, /loadABCDTokenV2Manifest/);
assert.match(config, /AUTHORITATIVE_ON_CHAIN_READ_ONLY/);
assert.match(routes, /authoritativeSources/);
assert.match(routes, /createABCDTokenV2AdminRead/);
assert.match(config, /ICO V3/);
assert.match(config, /LendingReferralManagerV2/);
assert.match(config, /InsuranceReserveV2/);
assert.match(routes, /router\.post\('\/audit'/);
assert.match(routes, /router\.patch\('\/audit\/:auditId'/);
assert.doesNotMatch(users, /Mock fallback users/);
assert.match(users, /KYC profile status does not grant or alter on-chain eligibility/);
console.log('Admin control-plane Phase 1 guards: PASS');
