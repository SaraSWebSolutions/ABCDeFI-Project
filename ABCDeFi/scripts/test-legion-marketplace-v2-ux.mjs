import assert from 'node:assert/strict';
import fs from 'node:fs';

const service = fs.readFileSync(new URL('../src/Services/legionMarketplaceV2.ts', import.meta.url), 'utf8');
const dashboard = fs.readFileSync(new URL('../src/components/LegionMarketplaceV2Dashboard.tsx', import.meta.url), 'utf8');
const shell = fs.readFileSync(new URL('../src/components/UserDashboard.tsx', import.meta.url), 'utf8');

assert.match(shell, /LegionMarketplaceV2Dashboard/);
assert.match(shell, /activeTab === 'legion-marketplace' && <LegionMarketplaceV2Dashboard/);
assert.match(service, /\/api\/legion-marketplace-v2/);
assert.match(service, /chainId !== '31337'/);
assert.match(service, /Number\(receipt\.status\) !== 1/);
assert.match(service, /Confirmed receipt did not contain/);
assert.match(service, /Confirmed on chain — waiting for indexer/);
assert.match(service, /requestTransfer/);
assert.match(service, /approveTransfer/);
assert.match(service, /settleSale/);
assert.match(service, /Only the named buyer may settle/);
assert.match(dashboard, /seller names one buyer/);
assert.match(dashboard, /Public transfers and approvals stay blocked/);
assert.doesNotMatch(dashboard, /auction|royalty|commission|Marketplace fee/i);
console.log('Legion marketplace controlled-settlement dashboard checks passed');
