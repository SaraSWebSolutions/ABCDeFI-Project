import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [portal, dashboard, service, server, runtime, navigation, primitives, navbar, ico, legion] = await Promise.all([
  readFile('src/components/AdminPortalEngine.tsx', 'utf8'),
  readFile('src/components/CanonicalAdminDashboard.tsx', 'utf8'),
  readFile('src/Services/canonicalAdmin.ts', 'utf8'),
  readFile('backend/backend/server.js', 'utf8'),
  readFile('src/Config/oneQRuntime.ts', 'utf8'),
  readFile('src/components/AdminConsoleNavigation.tsx', 'utf8'),
  readFile('src/components/AdminControlPlanePrimitives.tsx', 'utf8'),
  readFile('src/components/Navbar.tsx', 'utf8'),
  readFile('src/components/CanonicalIcoV3Admin.tsx', 'utf8'),
  readFile('src/components/CanonicalLegionNFTV2Admin.tsx', 'utf8'),
]);

const activePortal = portal.split('const LegacyAdminPortalEngine')[0];
assert.match(activePortal, /CanonicalAdminDashboard/);
assert.match(dashboard, /Runtime identity:/);
assert.match(dashboard, /Indexer checkpoint:/);
assert.match(dashboard, /Authority: authoritative on-chain snapshot/);
assert.match(dashboard, /Token event-indexed emergency reconciliation is not configured/);
assert.match(service, /AUTHORITATIVE_ON_CHAIN/);
assert.doesNotMatch(activePortal, /<ICOAdmin\s*\/>/);
assert.doesNotMatch(activePortal, /<AdminNftIssuance\s*\/>/);
assert.match(dashboard, /Canonical admin provenance/);
assert.match(dashboard, /CanonicalP2PAdmin/);
assert.match(dashboard, /can\(applicationCapability, 'p2p\.read'\)/);
assert.match(service, /EMIManagerV2: \{ contract: 'EMIManagerV2', roles: \['DEFAULT_ADMIN_ROLE'\] \}/);
assert.match(service, /EMIManagerV2: \{ contract: 'EMIManagerV2', pauseRole: 'DEFAULT_ADMIN_ROLE', unpauseRole: 'DEFAULT_ADMIN_ROLE' \}/);
assert.doesNotMatch(service, /P2P: \{ contract: 'EMIManagerV2'/);
assert.match(dashboard, /Admin operation audit/);
assert.match(dashboard, /Mark failed — no transaction submitted/);
assert.match(dashboard, /No transaction was submitted\./);
assert.match(dashboard, /reconcileNoSubmissionAudit/);
assert.match(dashboard, /audit\.state === 'PENDING' && !audit\.transactionHash/);
assert.match(dashboard, /never grants a blockchain role/);
assert.match(dashboard, /Review emergency \{action\}/);
assert.match(dashboard, /Canonical indexer is stale/);
assert.match(dashboard, /no success is reported/);
assert.match(service, /Authorization: `Bearer \$\{token\}`/);
assert.match(service, /getConnectedAdminRoleStatus/);
assert.match(service, /executeEmergencyPauseAction/);
assert.match(service, /The transaction receipt did not contain the expected canonical module event/);
assert.match(server, /\/api\/admin\/canonical/);
// Provider discovery is deliberately not an application connection.  The
// capability model keeps account mismatch, signer, chain, runtime, and role
// status separate and blocks a write before PENDING/audit creation.
for (const state of ['CONNECTED', 'SIGNER_AVAILABLE', 'SIGNER_UNAVAILABLE', 'CORRECT_CHAIN', 'WRONG_CHAIN', 'RUNTIME_AVAILABLE', 'RUNTIME_UNAVAILABLE', 'ROLE_HELD', 'ROLE_NOT_HELD']) assert.match(service, new RegExp(state));
assert.match(service, /getAdminWalletCapability/);
assert.match(service, /requireAdminWriteCapability/);
assert.match(service, /application wallet and provider wallet differ/i);
assert.match(service, /base\.application === 'CONNECTED' && Boolean\(providerWallet\) && accountMatch && signer === 'SIGNER_AVAILABLE' && chain === 'CORRECT_CHAIN' && base\.runtime === 'RUNTIME_AVAILABLE'/);
assert.match(service, /The selected provider account cannot provide a signer/);
assert.match(service, /canonical 1Q_LOCAL requires chain 31337/);
assert.match(service, /The explicit canonical runtime is unavailable/);
assert.match(dashboard, /Connected Wallet \/ Blockchain Capabilities/);
assert.match(dashboard, /BlockchainCapabilityCard/);
assert.match(dashboard, /connect the wallet through the application before an Admin write is eligible/i);
// The configured operator is an explicit 1Q_LOCAL display identity only. It
// cannot enter the provider/signer capability model or replace live role reads.
assert.match(runtime, /ONE_Q_LOCAL_ADMIN_IDENTITY/);
assert.match(runtime, /operationalAdminWallet: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'/);
assert.match(runtime, /rootDefaultAdminWallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'/);
assert.match(runtime, /Explicit 1Q_LOCAL Admin operator configuration/);
assert.match(runtime, /runtimeFamily !== ONE_Q_LOCAL/);
assert.match(runtime, /addressPattern\.test\(configuredIdentity\.operationalAdminWallet\)/);
assert.match(dashboard, /Operational Admin Wallet/);
assert.match(dashboard, /CONNECTED OPERATOR WALLET/);
assert.match(dashboard, /CONFIGURED, NOT CONNECTED/);
assert.match(dashboard, /Root\/DEFAULT_ADMIN identity/);
assert.match(dashboard, /Display-only configuration\. It never selects a provider account, creates a signer, grants a role, or bypasses live module hasRole\(\) verification\./);
assert.match(dashboard, /getConnectedAdminRoleStatus\(next\.modules, nextCapability\.providerWallet\)/);
assert.match(primitives, /No canonical source is configured for this deployment/);
assert.match(primitives, /This section is unavailable\/read-only/);
assert.match(primitives, /Status: \{authorized \? 'AUTHORIZED' : 'NOT AUTHORIZED'\}/);
assert.match(primitives, /Preflight.*Wallet.*Chain.*On-chain role.*Receipt.*Expected event.*Indexer.*API reconciliation.*Audit/s);
assert.match(primitives, /No transaction has been submitted/);
assert.match(primitives, /Confirming opens the connected wallet/);
assert.match(dashboard, /AdminWriteConfirmationDialog/);
assert.match(ico, /AdminWriteConfirmationDialog/);
assert.match(legion, /AdminWriteConfirmationDialog/);
for (const group of ['Administration', 'Operations', 'Lending', 'Treasury & Token', 'Security', 'Audit & System']) assert.match(navigation, new RegExp(group.replace(/[&]/g, '\\&')));
assert.match(navigation, /consoleNavigationGroupsFor/);
assert.match(navbar, /ABCDeFi/);
assert.match(navbar, /Administration/);
assert.match(navbar, /balanceABCD/);
assert.doesNotMatch(service, /operationalAdminWallet|ONE_Q_ADMIN_IDENTITY|rootDefaultAdminWallet/);
const emergencyAuditCreation = service.lastIndexOf('createCanonicalAdminAudit(token, module.name, action, transaction.hash)');
assert.ok(service.indexOf('requireAdminWriteCapability(capability)') < emergencyAuditCreation);
assert.ok(service.indexOf('if (!await contract.hasRole') < emergencyAuditCreation);
assert.ok(service.indexOf('if (Boolean(await contract.paused())') < emergencyAuditCreation);
assert.ok(service.indexOf('const transaction = await contract[action]()') < emergencyAuditCreation);
assert.match(service, /Treasury: \{ contract: 'TreasuryV2', roles: \['DEFAULT_ADMIN_ROLE', 'ASSET_MANAGER_ROLE', 'FUNDER_MANAGER_ROLE'/);
assert.doesNotMatch(service, /function execute\(.*calldata/i);
console.log('Canonical Admin UX guards: PASS');
