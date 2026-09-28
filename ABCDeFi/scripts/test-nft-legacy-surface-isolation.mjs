import assert from 'node:assert/strict';
import fs from 'node:fs';

const userDashboard = fs.readFileSync(new URL('../src/components/UserDashboard.tsx', import.meta.url), 'utf8');
const portfolio = fs.readFileSync(new URL('../src/components/PortfolioDashboard.tsx', import.meta.url), 'utf8');
const overview = fs.readFileSync(new URL('../src/components/NextGenProtocolDashboard.tsx', import.meta.url), 'utf8');
const legacyService = fs.readFileSync(new URL('../src/Services/nftEcosystem.ts', import.meta.url), 'utf8');
const traceability = fs.readFileSync(new URL('../docs/nft-whitepaper-traceability.md', import.meta.url), 'utf8');
const legionService = fs.readFileSync(new URL('../src/Services/legionNFTV2.ts', import.meta.url), 'utf8');
const franchiseService = fs.readFileSync(new URL('../src/Services/franchiseRegistryV2.ts', import.meta.url), 'utf8');

assert.match(userDashboard, /id: 'loan-nft-certificates', label: 'Loan Completion NFTs'/);
assert.match(userDashboard, /LoanNftV2Certificates/);
assert.match(userDashboard, /id: 'abcd-nft-marketplace', label: 'ABCD NFT Marketplace'/);
assert.match(userDashboard, /id: 'legion-marketplace', label: 'Legion Settlement'/);
assert.doesNotMatch(userDashboard, /from ['"]\.\/NFTEcosystem['"]/);
assert.doesNotMatch(userDashboard, /id: 'nft-ecosystem', label: 'Owned NFTs'/);
assert.doesNotMatch(portfolio, /getNftEcosystemSnapshot/);
assert.doesNotMatch(overview, /getNftEcosystemSnapshot/);
assert.match(legacyService, /Historical\/non-canonical NFT V1 service/);
assert.match(traceability, /Canonical V2 boundary — current source of truth/);
assert.match(traceability, /Historical V1 inventory — preserved, non-canonical/);
assert.match(traceability, /\/api\/legion-nft-v2/);
assert.match(traceability, /\/api\/franchise-v2/);
assert.match(traceability, /OWNER DECISION REQUIRED/);
assert.match(legionService, /\/api\/legion-nft-v2/);
assert.match(franchiseService, /\/api\/franchise-v2/);

console.log('Canonical NFT legacy-surface isolation checks passed');
