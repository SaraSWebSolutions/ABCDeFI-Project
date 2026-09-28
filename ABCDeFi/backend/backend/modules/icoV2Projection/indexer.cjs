const {Interface}=require('ethers');
const lower=(v)=>typeof v==='string'?v.toLowerCase():v;
// Projection storage uses one canonical representation for all decoded addresses.
const value=(input,v)=>typeof v==='bigint'?v.toString():input.type==='address'?lower(v):v;
class IcoV2Indexer {
  constructor({manifest,artifact,provider,models}) { this.manifest=manifest; this.provider=provider; this.models=models; this.iface=new Interface(artifact.abi); this.topics=artifact.abi.filter((x)=>x.type==='event').map((x)=>this.iface.getEvent(x.name).topicHash); }
  identity(){return {chainId:String(this.manifest.chainId),deploymentVersion:this.manifest.deploymentVersion,icoAddress:lower(this.manifest.address)};}
  async assertDeployment(){const [network,code]=await Promise.all([this.provider.getNetwork(),this.provider.getCode(this.manifest.address)]);if(Number(network.chainId)!==this.manifest.chainId||code==='0x')throw new Error('ICOManagerV2 canonical deployment is unavailable or on the wrong chain.');}
  async syncOnce(){
    await this.assertDeployment(); const identity=this.identity(); const prior=await this.models.IcoV2Checkpoint.findOne(identity).lean();
    if(prior?.lastProcessedBlock){const block=await this.provider.getBlock(Number(prior.lastProcessedBlock));if(!block||lower(block.hash)!==lower(prior.lastProcessedBlockHash))throw new Error('ICO V2 checkpoint does not match the active canonical chain.');}
    const latest=await this.provider.getBlockNumber(); const from=prior?.lastProcessedBlock?Number(prior.lastProcessedBlock)+1:this.manifest.deploymentBlock;
    if(latest<from)return {checkpoint:prior?.lastProcessedBlock||null,processed:0};
    const logs=await this.provider.getLogs({address:this.manifest.address,topics:[this.topics],fromBlock:from,toBlock:latest});
    logs.sort((a,b)=>Number(a.blockNumber)-Number(b.blockNumber)||Number(a.index??a.logIndex)-Number(b.index??b.logIndex));
    for(const log of logs){const parsed=this.iface.parseLog({topics:log.topics,data:log.data});if(!parsed)continue;const args=Object.fromEntries(parsed.fragment.inputs.map((input,i)=>[input.name||String(i),value(input,parsed.args[i])]));const event={...identity,transactionHash:lower(log.transactionHash),blockNumber:String(log.blockNumber),logIndex:Number(log.index??log.logIndex),blockHash:lower(log.blockHash),eventName:parsed.name,args,indexedAt:new Date()};await this.models.IcoV2Event.updateOne({...identity,transactionHash:event.transactionHash,logIndex:event.logIndex},{$setOnInsert:event},{upsert:true});}
    const block=await this.provider.getBlock(latest);await this.models.IcoV2Checkpoint.updateOne(identity,{$set:{...identity,lastProcessedBlock:String(latest),lastProcessedBlockHash:lower(block.hash),indexedAt:new Date()}},{upsert:true});return {checkpoint:String(latest),processed:logs.length};
  }
}
module.exports={IcoV2Indexer};
