const { Contract, Interface } = require('ethers');
const SCOPE = 'canonical-legion-nft-v2';
const EVENTS = Object.freeze(['Transfer', 'TerritoryMinted', 'TerritoryMetadataUpdated', 'TransferRequested', 'TransferApproved', 'TransferCancelled', 'TransferExecuted', 'Paused', 'Unpaused']);
const LEVELS = Object.freeze(['COUNTRY', 'STATE', 'DISTRICT']);
const lower = (value) => typeof value === 'string' ? value.toLowerCase() : value;
const stringify = (value) => typeof value === 'bigint' ? value.toString() : value;
const eventArgs = (parsed) => Object.fromEntries(parsed.fragment.inputs.map((input, index) => [input.name || String(index), stringify(parsed.args[index])]));
const evidence = (log, eventName) => ({ transactionHash: lower(log.transactionHash), blockNumber: String(log.blockNumber), logIndex: Number(log.index ?? log.logIndex), blockHash: lower(log.blockHash), eventName });

class LegionNFTV2Indexer {
  constructor({ manifest, artifact, provider, models, logger = console, confirmations = 2, blockRange = 250 }) {
    this.manifest = manifest; this.provider = provider; this.models = models; this.logger = logger; this.confirmations = confirmations; this.blockRange = blockRange;
    this.iface = new Interface(artifact.abi); this.contract = new Contract(manifest.contractAddress, artifact.abi, provider); this.topics = EVENTS.map((name) => this.iface.getEvent(name).topicHash); this.running = false;
  }
  identity() { return { chainId: String(this.manifest.chainId), deploymentVersion: this.manifest.deploymentVersion, contractAddress: this.manifest.contractAddress, scope: SCOPE }; }
  async assertDeployment() { const [network, code] = await Promise.all([this.provider.getNetwork(), this.provider.getCode(this.manifest.contractAddress)]); if (Number(network.chainId) !== this.manifest.chainId) throw new Error(`RPC chain ${network.chainId} does not match canonical LegionNFTV2 chain ${this.manifest.chainId}.`); if (code === '0x' || code === '0x0') throw new Error(`No LegionNFTV2 bytecode exists at ${this.manifest.contractAddress}.`); }
  async readTerritory(tokenId) {
    const [owner, territory, metadataURI, requestId] = await Promise.all([this.contract.ownerOf(tokenId), this.contract.getTerritory(tokenId), this.contract.tokenURI(tokenId), this.contract.activeTransferRequestForToken(tokenId)]);
    const level = LEVELS[Number(territory.level)]; if (!level) throw new Error(`LegionNFTV2 returned an unknown territory level for token ${tokenId}.`);
    return { chainId: String(this.manifest.chainId), deploymentVersion: this.manifest.deploymentVersion, contractAddress: this.manifest.contractAddress, tokenId: String(tokenId), owner: lower(owner), level, parentId: String(territory.parentId), population: String(territory.population), displayName: territory.displayName, canonicalIdentifier: territory.canonicalIdentifier, metadataURI, territoryKey: territory.territoryKey, activeTransferRequestId: String(requestId) };
  }
  async readRequest(requestId) { const request = await this.contract.getTransferRequest(requestId); return { chainId: String(this.manifest.chainId), deploymentVersion: this.manifest.deploymentVersion, contractAddress: this.manifest.contractAddress, requestId: String(requestId), tokenId: String(request.tokenId), currentOwner: lower(request.currentOwner), proposedOwner: lower(request.proposedOwner), active: Boolean(request.active), approved: Boolean(request.approved) }; }
  async upsertTerritory(tokenId) { const territory = await this.readTerritory(tokenId); await this.models.LegionNFTV2Territory.updateOne({ chainId: territory.chainId, deploymentVersion: territory.deploymentVersion, contractAddress: territory.contractAddress, tokenId: territory.tokenId }, { $set: { ...territory, indexedAt: new Date() } }, { upsert: true }); }
  async upsertRequest(requestId) { const request = await this.readRequest(requestId); await this.models.LegionNFTV2TransferRequest.updateOne({ chainId: request.chainId, deploymentVersion: request.deploymentVersion, contractAddress: request.contractAddress, requestId: request.requestId }, { $set: { ...request, indexedAt: new Date() } }, { upsert: true }); return request; }
  async processLog(log) {
    const parsed = this.iface.parseLog({ topics: log.topics, data: log.data }); if (!parsed || !EVENTS.includes(parsed.name)) return;
    const tokenId = parsed.args.tokenId === undefined ? null : String(parsed.args.tokenId); const requestId = parsed.args.requestId === undefined ? null : String(parsed.args.requestId);
    const record = { chainId: String(this.manifest.chainId), deploymentVersion: this.manifest.deploymentVersion, contractAddress: this.manifest.contractAddress, transactionHash: lower(log.transactionHash), blockNumber: String(log.blockNumber), transactionIndex: Number(log.transactionIndex), logIndex: Number(log.index ?? log.logIndex), blockHash: lower(log.blockHash), eventName: parsed.name, tokenId, requestId, args: eventArgs(parsed), removed: Boolean(log.removed) };
    const { removed, ...insertRecord } = record;
    const persisted = await this.models.LegionNFTV2Event.updateOne({ chainId: record.chainId, deploymentVersion: record.deploymentVersion, transactionHash: record.transactionHash, logIndex: record.logIndex }, { $setOnInsert: insertRecord, $set: { removed, indexedAt: new Date() } }, { upsert: true });
    if (!persisted.upsertedCount || record.removed) return;
    if (requestId !== null) { const request = await this.upsertRequest(requestId); await this.upsertTerritory(request.tokenId); }
    else if (tokenId !== null && parsed.name !== 'Transfer') await this.upsertTerritory(tokenId);
    else if (parsed.name === 'Transfer' && tokenId !== null) await this.upsertTerritory(tokenId);
  }
  async syncOnce() {
    await this.assertDeployment(); const checkpoint = await this.models.LegionNFTV2Checkpoint.findOne(this.identity()).lean();
    if (checkpoint?.lastProcessedBlock) { const block = await this.provider.getBlock(Number(checkpoint.lastProcessedBlock)); if (!block || lower(block.hash) !== lower(checkpoint.lastProcessedBlockHash)) throw new Error('LegionNFTV2 checkpoint does not match the active chain; refusing stale projection.'); }
    const latest = await this.provider.getBlockNumber(); const target = latest - this.confirmations; let from = checkpoint?.lastProcessedBlock ? Number(checkpoint.lastProcessedBlock) + 1 : this.manifest.deploymentBlock;
    if (target < from) return { checkpoint: checkpoint?.lastProcessedBlock || null, processed: 0 };
    for (; from <= target; from += this.blockRange) { const to = Math.min(target, from + this.blockRange - 1); const logs = await this.provider.getLogs({ address: this.manifest.contractAddress, topics: [this.topics], fromBlock: from, toBlock: to }); logs.sort((a,b) => Number(a.blockNumber)-Number(b.blockNumber) || Number(a.index ?? a.logIndex)-Number(b.index ?? b.logIndex)); for (const log of logs) await this.processLog(log); const block = await this.provider.getBlock(to); await this.models.LegionNFTV2Checkpoint.updateOne(this.identity(), { $set: { lastProcessedBlock: String(to), lastProcessedBlockHash: lower(block.hash), paused: Boolean(await this.contract.paused()), indexedAt: new Date() } }, { upsert: true }); }
    return { checkpoint: String(target), processed: target };
  }
  async start(pollIntervalMs = 5000) { if (this.running) return; this.running = true; const loop = async () => { if (!this.running) return; try { await this.syncOnce(); this.logger.info({ component: 'legion-nft-v2-indexer', message: 'Synchronization cycle completed' }); } catch (error) { this.logger.error({ component: 'legion-nft-v2-indexer', message: error.message }); } if (this.running) this.timer = setTimeout(loop, pollIntervalMs); }; await loop(); }
  async stop() { this.running = false; if (this.timer) clearTimeout(this.timer); }
}
module.exports = { SCOPE, EVENTS, LegionNFTV2Indexer, LEVELS, lower, stringify, evidence };
