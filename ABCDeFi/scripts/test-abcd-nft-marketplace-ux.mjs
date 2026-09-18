import assert from 'node:assert/strict';
import fs from 'node:fs';

const service = fs.readFileSync(new URL('../src/Services/abcdNftMarketplaceV2.ts', import.meta.url), 'utf8');
const dashboard = fs.readFileSync(new URL('../src/components/ABCDNFTMarketplaceV2Dashboard.tsx', import.meta.url), 'utf8');
const shell = fs.readFileSync(new URL('../src/components/UserDashboard.tsx', import.meta.url), 'utf8');

assert.match(shell, /ABCDNFTMarketplaceV2Dashboard/);
assert.match(shell, /activeTab === 'abcd-nft-marketplace' && <ABCDNFTMarketplaceV2Dashboard/);
assert.match(service, /\/api\/abcd-nft-marketplace-v2/);
assert.match(service, /source: status\.source/);
assert.match(service, /chainId !== '31337'/);
assert.match(service, /Number\(receipt\.status\) !== 1/);
assert.match(service, /Confirmed receipt did not contain/);
assert.match(service, /Transaction rejected in MetaMask\. No on-chain state changed\./);
assert.match(service, /revalidation: 'STALE'/);
assert.match(service, /Marketplace approval was removed/);
assert.match(service, /Confirmed on chain — waiting for indexer/);
assert.match(dashboard, /Listings are non-custodial/);
assert.match(dashboard, /ABCD fixed price/);
assert.match(dashboard, /Not currently purchasable/);
assert.match(dashboard, /listing\.revalidation !== 'CURRENT'/);
assert.doesNotMatch(dashboard, /ETH payment|BNB payment|royalty|marketplace fee|treasury deduction/i);
console.log('ABCD NFT marketplace canonical dashboard checks passed');
