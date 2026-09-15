import assert from 'node:assert/strict';
import fs from 'node:fs';

const dashboard = fs.readFileSync(new URL('../src/components/FranchiseRegistryDashboard.tsx', import.meta.url), 'utf8');
const service = fs.readFileSync(new URL('../src/Services/franchiseRegistryV2.ts', import.meta.url), 'utf8');
const shell = fs.readFileSync(new URL('../src/components/UserDashboard.tsx', import.meta.url), 'utf8');

assert.match(shell, /FranchiseRegistryDashboard/);
assert.match(shell, /activeTab === 'franchise' && <FranchiseRegistryDashboard/);
assert.match(dashboard, /Administrative business-unit assignments only/);
assert.match(dashboard, /no legal territory title, price, purchase, commission, Treasury, Lending, Referral, Legion, or marketplace right/);
assert.doesNotMatch(dashboard, /list for sale|buy franchise|priceUSD|commissionBps|revenue share/i);
assert.match(service, /canonical-indexed-on-chain/);
assert.match(service, /registryAddress/);
assert.doesNotMatch(service, /listFranchise|marketplace|priceUSD|commissionBps|legionNFTId/i);
console.log('Franchise foundation dashboard integration checks passed');
