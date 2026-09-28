const { Contract, Interface } = require('ethers');
const { projectionRuntimeFields, checkpointRuntimeFields } = require('../../config/projectionRuntimeContext.cjs');
const ADAPTER_EVENTS = ['SaleCreated', 'SaleRequestLinked', 'SaleCancelled', 'SaleMarkedNotSettleable', 'SaleSettled', 'Paused', 'Unpaused'];
const LEGION_EVENTS = ['TransferRequested', 'TransferApproved', 'TransferCancelled', 'TransferExecuted', 'MarketplaceTransferExecuted'];
const lower = (value) => typeof value === 'string' ? value.toLowerCase() : value;
const stringify = (value) => typeof value === 'bigint' ? value.toString() : value;
const argsOf = (parsed) => Object.fromEntries(parsed.fragment.inputs.map((input, index) => [input.name || String(index), stringify(parsed.args[index])]));
const evidence = (log, eventName) => ({ transactionHash: lower(log.transactionHash), blockNumber: String(log.blockNumber), logIndex: Number(log.index ?? log.logIndex), blockHash: lower(log.blockHash), eventName });

class LegionMarketplaceIndexer {
  constructor({ manifest, artifact, legionArtifact, provider, models, confirmations = 0 }) {
    this.manifest = manifest; this.provider = provider; this.models = models; this.confirmations = confirmations;
    this.adapterIface = new Interface(artifact.abi); this.legionIface = new Interface((legionArtifact || require('../../../../artifacts/contracts/nft/LegionNFTV2.sol/LegionNFTV2.json')).abi);
    this.settlement = new Contract(manifest.settlementAddress, artifact.abi, provider);
    this.adapterTopics = ADAPTER_EVENTS.map((name) => this.adapterIface.getEvent(name).topicHash);
    this.legionTopics = LEGION_EVENTS.map((name) => this.legionIface.getEvent(name).topicHash);
  }
  identity() { return { chainId: String(this.manifest.chainId), deploymentVersion: this.manifest.deploymentVersion, ...projectionRuntimeFields(this.manifest), settlementAddress: this.manifest.settlementAddress }; }
  async assertDeployment() {
    const [network, adapterCode, legionCode, legion, abcd] = await Promise.all([this.provider.getNetwork(), this.provider.getCode(this.manifest.settlementAddress), this.provider.getCode(this.manifest.legionAddress), this.settlement.legion(), this.settlement.abcdToken()]);
    if (Number(network.chainId) !== this.manifest.chainId) throw new Error('Legion marketplace RPC chain does not match manifest.');
    if (adapterCode === '0x' || legionCode === '0x' || lower(legion) !== this.manifest.legionAddress || lower(abcd) !== this.manifest.abcdAddress) throw new Error('Canonical Legion marketplace bytecode or bindings are invalid.');
  }
  async _upsertEvent(log, parsed) {
    const immutable = { ...this.identity(), contractAddress: lower(log.address), transactionHash: lower(log.transactionHash), blockNumber: String(log.blockNumber), logIndex: Number(log.index ?? log.logIndex), blockHash: lower(log.blockHash), eventName: parsed.name, args: argsOf(parsed) };
    const result = await this.models.LegionMarketplaceEvent.updateOne({ ...this.identity(), contractAddress: immutable.contractAddress, transactionHash: immutable.transactionHash, logIndex: immutable.logIndex }, { $setOnInsert: immutable, $set: { removed: Boolean(log.removed), indexedAt: new Date() } }, { upsert: true });
    return { result, args: immutable.args, ev: evidence(log, parsed.name) };
  }
  async _findSale(filter) { return this.models.LegionMarketplaceSale.findOne({ ...this.identity(), ...filter }).lean(); }
  async _updateSale(saleId, update) { await this.models.LegionMarketplaceSale.updateOne({ ...this.identity(), saleId: String(saleId) }, { $set: { ...update, indexedAt: new Date() } }); }
  async _processAdapter(parsed, args, ev) {
    if (parsed.name === 'SaleCreated') await this.models.LegionMarketplaceSale.updateOne({ ...this.identity(), saleId: args.saleId }, { $set: { ...this.identity(), saleId: args.saleId, tokenId: args.tokenId, requestId: null, seller: lower(args.seller), buyer: lower(args.buyer), price: args.price, status: 'AWAITING_LEGION_REQUEST', createdEvidence: ev, latestEvidence: ev, indexedAt: new Date() } }, { upsert: true });
    if (parsed.name === 'SaleRequestLinked') await this._updateSale(args.saleId, { requestId: args.requestId, status: 'LEGION_ADMIN_APPROVAL_PENDING', latestEvidence: ev });
    if (parsed.name === 'SaleCancelled') await this._updateSale(args.saleId, { status: 'CANCELLED', latestEvidence: ev });
    if (parsed.name === 'SaleMarkedNotSettleable') await this._updateSale(args.saleId, { status: args.status === '4' ? 'STALE' : 'CANCELLED', latestEvidence: ev });
    if (parsed.name === 'SaleSettled') await this._updateSale(args.saleId, { status: 'SETTLED', requestId: args.requestId, latestEvidence: ev });
  }
  async _processLegion(parsed, args, ev) {
    if (parsed.name === 'TransferRequested') {
      const sale = await this._findSale({ tokenId: args.tokenId, seller: lower(args.currentOwner), buyer: lower(args.proposedOwner), status: 'AWAITING_LEGION_REQUEST' });
      if (sale) await this._updateSale(sale.saleId, { requestId: args.requestId, status: 'LEGION_REQUEST_PENDING', latestEvidence: ev });
      return;
    }
    const sale = await this._findSale({ requestId: args.requestId });
    if (!sale) return;
    if (parsed.name === 'TransferApproved') await this._updateSale(sale.saleId, { status: 'READY_FOR_SETTLEMENT', latestEvidence: ev });
    if (parsed.name === 'TransferCancelled') await this._updateSale(sale.saleId, { status: 'CANCELLED', latestEvidence: ev });
    if (parsed.name === 'MarketplaceTransferExecuted') await this._updateSale(sale.saleId, { status: 'SETTLED', latestEvidence: ev });
  }
  async process(log) {
    const isAdapter = lower(log.address) === this.manifest.settlementAddress;
    const iface = isAdapter ? this.adapterIface : this.legionIface; const permitted = isAdapter ? ADAPTER_EVENTS : LEGION_EVENTS;
    const parsed = iface.parseLog({ topics: log.topics, data: log.data }); if (!parsed || !permitted.includes(parsed.name)) return;
    const { result, args, ev } = await this._upsertEvent(log, parsed); if (!result.upsertedCount || log.removed) return;
    if (isAdapter) await this._processAdapter(parsed, args, ev); else await this._processLegion(parsed, args, ev);
  }
  async syncOnce() {
    await this.assertDeployment(); const identity = this.identity(); const checkpoint = await this.models.LegionMarketplaceCheckpoint.findOne(identity).lean();
    if (checkpoint?.lastProcessedBlock) { const block = await this.provider.getBlock(Number(checkpoint.lastProcessedBlock)); if (!block || lower(block.hash) !== lower(checkpoint.lastProcessedBlockHash)) throw new Error('Legion marketplace checkpoint does not match active chain.'); }
    const latest = await this.provider.getBlockNumber(); const target = latest - this.confirmations; const from = checkpoint?.lastProcessedBlock ? Number(checkpoint.lastProcessedBlock) + 1 : this.manifest.deploymentBlock;
    if (target < from) return { checkpoint: checkpoint?.lastProcessedBlock || null, processed: 0 };
    const [adapterLogs, legionLogs] = await Promise.all([this.provider.getLogs({ address: this.manifest.settlementAddress, topics: [this.adapterTopics], fromBlock: from, toBlock: target }), this.provider.getLogs({ address: this.manifest.legionAddress, topics: [this.legionTopics], fromBlock: from, toBlock: target })]);
    const logs = [...adapterLogs, ...legionLogs].sort((a,b) => Number(a.blockNumber)-Number(b.blockNumber) || Number(a.index ?? a.logIndex)-Number(b.index ?? b.logIndex));
    for (const log of logs) await this.process(log);
    const block = await this.provider.getBlock(target); const runtime = await checkpointRuntimeFields(this.manifest, this.provider, [this.manifest.settlementAddress, this.manifest.legionAddress, this.manifest.abcdAddress]); await this.models.LegionMarketplaceCheckpoint.updateOne(identity, { $set: { ...identity, ...runtime, lastProcessedBlock: String(target), lastProcessedBlockHash: lower(block.hash), indexedAt: new Date() } }, { upsert: true });
    return { checkpoint: String(target), processed: logs.length };
  }
}
module.exports = { LegionMarketplaceIndexer, ADAPTER_EVENTS, LEGION_EVENTS };
