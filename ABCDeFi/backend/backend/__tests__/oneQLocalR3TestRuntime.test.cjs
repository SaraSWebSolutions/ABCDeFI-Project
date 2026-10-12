const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),r=require('../config/oneQLocalR3TestRuntime.cjs');
const env={ABCDEFI_RUNTIME_FAMILY:r.ONE_Q_LOCAL_R3_TEST,ABCDEFI_R3_TEST_DESCRIPTOR_PATH:'.e2e-runtime/oneq-local-r3-persistent-test/runtime-descriptor.json',MONGODB_URI:'mongodb://127.0.0.1:27017/abcdefi_oneq_local_r3_test_20261008'},base=JSON.parse(fs.readFileSync(r.DESCRIPTOR,'utf8'));
const copy=()=>JSON.parse(JSON.stringify(base));
function reject(n,m=()=>{},e={}){test(n,()=>{const d=copy(),old=fs.readFileSync;m(d);fs.readFileSync=(p,...a)=>String(p)===r.DESCRIPTOR?JSON.stringify(d):old(p,...a);try{assert.throws(()=>r.load({environment:{...env,...e}}),/rejected|invalid|mismatch/)}finally{fs.readFileSync=old}})}
test('00 valid R3 fixture accepts',()=>assert.equal(r.load({environment:env}).family,r.ONE_Q_LOCAL_R3_TEST));
test('00a sealed descriptor accepts only its exact predecessor bytes',()=>{
 const original=fs.readFileSync;const identities=['a'.repeat(63),'a'.repeat(65),'g'.repeat(64),'','0x'+'a'.repeat(64)];
 try{
  for(const identity of identities){
   const d=copy();d.deploymentIdentity=identity;
   fs.readFileSync=(p,...a)=>String(p)===r.DESCRIPTOR?JSON.stringify(d):original(p,...a);
   assert.throws(()=>r.load({environment:env}),/rejected|invalid|mismatch/);
  }
 }finally{fs.readFileSync=original}
});
const cases=[['01 missing family',()=>{},{ABCDEFI_RUNTIME_FAMILY:''}],['02 wrong family',()=>{},{ABCDEFI_RUNTIME_FAMILY:'X'}],['03 1Q local',()=>{},{ABCDEFI_RUNTIME_FAMILY:'1Q_LOCAL'}],['04 8546',d=>d.rpcUrl='http://127.0.0.1:8546'],['05 8558',d=>d.rpcUrl='http://127.0.0.1:8558'],['06 RPC',d=>d.rpcUrl='x'],['07 chain',d=>d.chainId=1],['08 deployment',d=>d.deploymentIdentity='x'],['09 no deployment',d=>delete d.deploymentIdentity],['10 contract',d=>d.contracts.ABCDTokenV2.address='x'],['11 malformed contract',d=>d.contracts.ABCDTokenV2.address='bad'],['12 bytecode',d=>d.contracts.ABCDTokenV2.bytecodeHash='x'],['13 no bytecode',d=>delete d.contracts.ABCDTokenV2.bytecodeHash],['14 state sha',d=>d.state.sha256='0'.repeat(64)],['15 state missing',d=>d.state.path='missing'],['16 provenance missing',d=>d.provenance.path='missing'],['17 block',d=>d.checkpoint.block=0],['18 hash',d=>d.checkpoint.hash='x'],['19 mongo',d=>d.mongoNamespace='wrong'],['20 R2 mongo',d=>d.mongoNamespace='b53_fresh_local_r2_live_20261008'],['21 protected mongo',d=>d.mongoNamespace='abcdefi_oneq_baseline_v2'],['22 no franchise',d=>delete d.topology.excludedModules.franchise],['23 franchise',d=>d.topology.modules=['franchise']],['24 historical',()=>{},{ABCDEFI_R3_TEST_DESCRIPTOR_PATH:'old'}],['25 arbitrary',()=>{},{ABCDEFI_R3_TEST_DESCRIPTOR_PATH:'x'}],['26 bsc testnet',d=>d.chainId=97],['27 bsc mainnet',d=>d.chainId=56],['28 port inference',()=>{},{ABCDEFI_RUNTIME_FAMILY:''}],['29 no config',()=>{},{ABCDEFI_RUNTIME_FAMILY:''}],['30 fallback',()=>{},{ABCDEFI_R3_TEST_DESCRIPTOR_PATH:''}],['31 replacement',d=>d.state.sha256='f'.repeat(64)],['32 checkpoint',d=>d.checkpoint.hash='0x'+'00'.repeat(32)],['33 family mismatch',()=>{},{ABCDEFI_RUNTIME_FAMILY:'1Q_LOCAL'}],['34 mongo deployment',()=>{},{MONGODB_URI:'mongodb://127.0.0.1:27017/x'}],['35 mongo rpc',()=>{},{MONGODB_URI:'mongodb://127.0.0.1:27017/x'}],['36 mongo chain',()=>{},{MONGODB_URI:'mongodb://127.0.0.1:27017/x'}],['37 provenance sha',d=>d.state.sha256='e'.repeat(64)]];for(const x of cases)reject(...x);

const bundle=JSON.parse(fs.readFileSync(r.CHILD_EVIDENCE_BUNDLE,'utf8'));
test('38 accepts all three sealed child manifests and preserves Franchise exclusion',()=>{
 const runtime=r.load({environment:env});
 for(const name of ['legion','marketplace10A','marketplace10B'])assert.ok(runtime.children[name]?.contracts);
 assert.deepEqual(runtime.children.franchise,{status:'excluded'});
});
for(const name of ['legion','marketplace10A','marketplace10B'])test(`39 rejects a tampered ${name} manifest`,()=>{
 const target=require('node:path').resolve(__dirname,'../../..',bundle.manifests[name].path);
 const original=fs.readFileSync;
 fs.readFileSync=(p,...a)=>String(p)===target?Buffer.from(`${original(p,...a).toString()} `):original(p,...a);
 try{assert.throws(()=>r.load({environment:env}),/rejected|mismatch/)}finally{fs.readFileSync=original}
});
test('40 rejects a missing child evidence bundle',()=>{
 const original=fs.readFileSync;
 fs.readFileSync=(p,...a)=>String(p)===r.CHILD_EVIDENCE_BUNDLE?(()=>{throw new Error('missing')})():original(p,...a);
 try{assert.throws(()=>r.load({environment:env}),/rejected|unavailable/)}finally{fs.readFileSync=original}
});
test('41 rejects wrong bundle bytes',()=>{
 const original=fs.readFileSync;
 fs.readFileSync=(p,...a)=>String(p)===r.CHILD_EVIDENCE_BUNDLE?Buffer.from(`${original(p,...a).toString()} `):original(p,...a);
 try{assert.throws(()=>r.load({environment:env}),/rejected|mismatch/)}finally{fs.readFileSync=original}
});
test('42 rejects a descriptor whose semantics match but predecessor bytes differ',()=>{
 const original=fs.readFileSync;
 fs.readFileSync=(p,...a)=>String(p)===r.DESCRIPTOR?JSON.stringify(base,null,2):original(p,...a);
 try{assert.throws(()=>r.load({environment:env}),/rejected|predecessor/)}finally{fs.readFileSync=original}
});
test('43 rejects an address-tampered child manifest',()=>{
 const target=require('node:path').resolve(__dirname,'../../..',bundle.manifests.marketplace10A.path);
 const original=fs.readFileSync;
 fs.readFileSync=(p,...a)=>{
  if(String(p)!==target)return original(p,...a);
  const child=JSON.parse(original(p,...a).toString());
  child.contracts.ABCDNFTMarketplaceV2.address='0x0000000000000000000000000000000000000001';
  return Buffer.from(JSON.stringify(child));
 };
 try{assert.throws(()=>r.load({environment:env}),/rejected|mismatch/)}finally{fs.readFileSync=original}
});
test('44 rejects live bytecode mismatch',async()=>{
 const runtime=r.load({environment:env});
 await assert.rejects(()=>r.verify(runtime,{getNetwork:async()=>({chainId:31337}),getBlock:async()=>({hash:runtime.checkpoint.hash}),getCode:async()=> '0x6000'}),/bytecode mismatch/);
});
