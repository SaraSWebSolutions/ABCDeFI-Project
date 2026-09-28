const test=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');const {Interface}=require('ethers');const {IcoV2Indexer}=require('../modules/icoV2Projection/indexer.cjs');
const artifact=require(path.resolve(__dirname,'../../../artifacts/contracts/ico/ICOManagerV2.sol/ICOManagerV2.json'));
const address='0x1000000000000000000000000000000000000001'; const tx='0x'+'1'.repeat(64); const hash='0x'+'2'.repeat(64);
function models(){
  const events=[]; let checkpoint=null;
  return { events, models: {
    IcoV2Event: {
      async updateOne(query, update) { if (events.some((event)=>event.transactionHash===query.transactionHash&&event.logIndex===query.logIndex)) return {upsertedCount:0}; events.push(update.$setOnInsert); return {upsertedCount:1}; },
    },
    IcoV2Checkpoint: { findOne() { return {lean:async()=>checkpoint}; }, async updateOne(_query, update) { checkpoint=update.$set; } },
  }};
}
test('ICO V2 projection accepts only canonical ordered ABI events, normalizes addresses, and is idempotent',async()=>{const iface=new Interface(artifact.abi);const checksumBuyer='0x70997970C51812dc3A010C7d01b50e0d17dc79C8';const encoded=iface.encodeEventLog(iface.getEvent('IcoPurchase'),[checksumBuyer,0,10n,100n,60000000000n,1n]);const pause=iface.encodeEventLog(iface.getEvent('Paused'),[address]);const logs=[{address,topics:pause.topics,data:pause.data,blockNumber:8,index:2,transactionHash:tx,blockHash:hash},{address,topics:encoded.topics,data:encoded.data,blockNumber:8,index:1,transactionHash:tx,blockHash:hash}];const {events,models:db}=models();const provider={getNetwork:async()=>({chainId:31337n}),getCode:async()=> '0x1234',getBlockNumber:async()=>8,getBlock:async()=>({hash}),getLogs:async(filter)=>{assert.equal(filter.address,address);return logs;}};const manifest={chainId:31337,deploymentVersion:'ico-v2-test',address,deploymentBlock:5};const indexer=new IcoV2Indexer({manifest,artifact,provider,models:db});const first=await indexer.syncOnce();const second=await indexer.syncOnce();assert.equal(first.processed,2);assert.equal(second.processed,0);assert.deepEqual(events.map((e)=>e.eventName),['IcoPurchase','Paused']);assert.equal(events[0].args.buyer,checksumBuyer.toLowerCase());assert.equal(events[0].args.allocation,'100');});
test('ICO V2 projection fails closed on a wrong canonical chain or checkpoint hash',async()=>{const {models:db}=models();const manifest={chainId:31337,deploymentVersion:'ico-v2-test',address,deploymentBlock:5};const wrongChain={getNetwork:async()=>({chainId:1n}),getCode:async()=> '0x1234'};await assert.rejects(()=>new IcoV2Indexer({manifest,artifact,provider:wrongChain,models:db}).syncOnce(),/wrong chain/);});
