import assert from 'node:assert/strict';
import fs from 'node:fs';

const admin = fs.readFileSync(new URL('../src/components/CanonicalLegionNFTV2Admin.tsx', import.meta.url), 'utf8');
const desktop = fs.readFileSync(new URL('../src/components/CanonicalAdminDashboard.tsx', import.meta.url), 'utf8');
const mobile = fs.readFileSync(new URL('../src/components/MobileUserDashboard.tsx', import.meta.url), 'utf8');
const service = fs.readFileSync(new URL('../src/Services/legionNFTV2.ts', import.meta.url), 'utf8');

assert.match(desktop, /CanonicalLegionNFTV2Admin/);
assert.match(admin, /hasLegionNFTV2AdminCapability/);
assert.match(admin, /getLegionNFTV2Territory/);
assert.match(admin, /getLegionNFTV2TransferRequest/);
assert.match(admin, /updateLegionNFTV2Metadata/);
assert.match(admin, /isLegionAdmin && request\.active && !request\.approved/);
assert.match(service, /getLegionNFTV2Territory/);
assert.match(service, /getLegionNFTV2TransferRequest/);
assert.match(service, /updateLegionNFTV2Metadata/);
assert.match(mobile, /LegionNFTV2Dashboard/);
assert.doesNotMatch(mobile, /LegionApp/);
console.log('LegionNFTV2 canonical admin and mobile-surface checks passed');
