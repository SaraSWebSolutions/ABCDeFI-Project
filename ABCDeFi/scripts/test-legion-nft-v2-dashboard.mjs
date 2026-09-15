import assert from 'node:assert/strict';
import fs from 'node:fs';

const dashboard = fs.readFileSync(new URL('../src/components/LegionNFTV2Dashboard.tsx', import.meta.url), 'utf8');
const service = fs.readFileSync(new URL('../src/Services/legionNFTV2.ts', import.meta.url), 'utf8');
assert.match(dashboard, /Country → State → District/);
assert.match(dashboard, /Registry-controlled transfer only/);
assert.doesNotMatch(dashboard, /List for sale|marketplace listing|approvalForAll/i);
assert.match(service, /requestTransfer/);
assert.match(service, /approveTransfer/);
assert.match(service, /executeTransfer/);
assert.doesNotMatch(service, /transferFrom\(/);
console.log('LegionNFTV2 dashboard integration checks passed');
