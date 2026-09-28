import assert from 'node:assert/strict';
import fs from 'node:fs';

const service = fs.readFileSync(new URL('../src/Services/loanNftV2Read.ts', import.meta.url), 'utf8');
const view = fs.readFileSync(new URL('../src/components/LoanNftV2Certificates.tsx', import.meta.url), 'utf8');
const userDashboard = fs.readFileSync(new URL('../src/components/UserDashboard.tsx', import.meta.url), 'utf8');

assert.match(service, /canonical-v2-indexed-on-chain/);
assert.match(service, /\/api\/lending-v2\/certificates\/wallet/);
assert.match(service, /\/api\/lending-v2\/certificates\/loans/);
assert.match(service, /\/api\/lending-v2\/certificates\/\$\{tokenId\}\/history/);
assert.match(service, /status !== 'AVAILABLE'/);
assert.match(service, /deploymentVersion/);
assert.match(view, /Your LoanNFTV2 completion certificates/);
assert.match(view, /Certificate provenance and transfer history/);
assert.match(view, /Informational 1% USD valuation/);
assert.match(view, /Read certificates for canonical loan/);
assert.match(view, /Read canonical certificate by token ID/);
assert.match(view, /no listing, sale, collateral, redemption, reward, fee, or Treasury action/);
assert.doesNotMatch(view, /Approve & list|Buy with ETH|mintCompletionCertificates/);
assert.match(userDashboard, /LoanNftV2Certificates/);
assert.match(userDashboard, /id: 'loan-nft-certificates', label: 'Loan Completion NFTs'/);
assert.doesNotMatch(userDashboard, /from ['"]\.\/NFTEcosystem['"]/);
console.log('LoanNFTV2 canonical read-only UX checks passed');
