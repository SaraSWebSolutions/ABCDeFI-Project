const { Contract, Interface } = require('ethers');

// v3 did not retain the immutable parent/operator fields from the canonical
// Registry record. A clean v4 rebuild is required rather than serving a
// partial hierarchy snapshot from an older checkpoint.
const SCOPE = 'canonical-franchise-foundation-v4';
const EVENTS = [
  'RoleGranted', 'RoleRevoked', 'RoleAdminChanged',
  'OperatorEligibilitySet', 'FranchiseRegistered', 'TransferRequested', 'TransferApproved',
  'TransferCancelled', 'FranchiseTransferred', 'FranchiseStatusChanged', 'Paused', 'Unpaused',
];
const lower = (value) => typeof value === 'string' ? value.toLowerCase() : value;
const asString = (value) => BigInt(value).toString();
const evidence = (log, eventName) => ({ transactionHash: lower(log.transactionHash), blockNumber: String(log.blockNumber), logIndex: Number(log.index ?? log.logIndex), blockHash: lower(log.blockHash), eventName });
const eventArgs = (parsed) => Object.fromEntries(parsed.fragment.inputs.map((input, index) => [input.name || String(index), typeof parsed.args[index] === 'bigint' ? parsed.args[index].toString() : parsed.args[index]]));
const requiresProjectionRebuild = (checkpoint) => Boolean(checkpoint && checkpoint.projectionScope !== SCOPE);

class FranchiseIndexer {
  constructor({ manifest, artifacts, provider, models, logger = console, confirmations = 2, blockRange = 250 }) {
    this.manifest = manifest; this.provider = provider; this.models = models; this.logger = logger; this.confirmations = confirmations; this.blockRange = blockRange;
    this.registryInterface = new Interface(artifacts.registry.abi);
    this.registry = new Contract(manifest.registryAddress, artifacts.registry.abi, provider);
    this.nft = new Contract(manifest.nftAddress, artifacts.nft.abi, provider);
    this.topics = EVENTS.map((name) => this.registryInterface.getEvent(name).topicHash);
    this.running = false; this.timer = null;
  }
  identity() { return { chainId: String(this.manifest.chainId), deploymentVersion: this.manifest.deploymentVersion, registryAddress: this.manifest.registryAddress }; }
  unscopedIdentity() { return { chainId: String(this.manifest.chainId), registryAddress: this.manifest.registryAddress }; }
  provenanceStartBlock() {
    const value = this.manifest.registryDeploymentBlock ?? this.manifest.deploymentBlock;
    if (!Number.isInteger(Number(value)) || Number(value) < 0) throw new Error('Canonical Franchise Registry deployment block is invalid.');
    return Number(value);
  }
  async assertDeployment() {
    const [network, registryCode, nftCode, boundRegistry] = await Promise.all([this.provider.getNetwork(), this.provider.getCode(this.manifest.registryAddress), this.provider.getCode(this.manifest.nftAddress), this.nft.registry()]);
    if (Number(network.chainId) !== this.manifest.chainId) throw new Error(`RPC chain ${network.chainId} does not match canonical Franchise chain ${this.manifest.chainId}`);
    if (registryCode === '0x' || nftCode === '0x') throw new Error('Canonical Franchise foundation bytecode is unavailable.');
    if (lower(boundRegistry) !== this.manifest.registryAddress) throw new Error('FranchiseNFT is not bound to the canonical FranchiseRegistry.');
  }
  async readCertificate(tokenId, metadataURI, latestEvidence) {
    const [owner, record] = await Promise.all([this.nft.ownerOf(tokenId), this.registry.getFranchise(tokenId)]);
    return { chainId: String(this.manifest.chainId), deploymentVersion: this.manifest.deploymentVersion, registryAddress: this.manifest.registryAddress, nftAddress: this.manifest.nftAddress, tokenId: asString(tokenId), owner: lower(owner), territoryKey: record.territoryKey, level: asString(record.level), parentTokenId: asString(record.parentTokenId), operator: lower(record.operator), status: asString(record.status), operatorVersion: asString(record.operatorVersion), metadataURI, latestEvidence };
  }
  async tokenIdForEvent(parsed) {
    if (parsed.args.tokenId !== undefined) return asString(parsed.args.tokenId);
    if (parsed.args.requestId !== undefined) return asString((await this.registry.getTransferRequest(parsed.args.requestId)).tokenId);
    return null;
  }
  async processLog(log) {
    const parsed = this.registryInterface.parseLog({ topics: log.topics, data: log.data });
    if (!parsed || !EVENTS.includes(parsed.name)) return;
    const record = { chainId: String(this.manifest.chainId), deploymentVersion: this.manifest.deploymentVersion, registryAddress: this.manifest.registryAddress, transactionHash: lower(log.transactionHash), blockNumber: String(log.blockNumber), logIndex: Number(log.index ?? log.logIndex), blockHash: lower(log.blockHash), eventName: parsed.name, args: eventArgs(parsed), removed: Boolean(log.removed), indexedAt: new Date() };
    const { removed, indexedAt, ...immutableRecord } = record;
    const result = await this.models.FranchiseEvent.updateOne({ chainId: record.chainId, deploymentVersion: record.deploymentVersion, registryAddress: record.registryAddress, transactionHash: record.transactionHash, logIndex: record.logIndex }, { $setOnInsert: immutableRecord, $set: { removed, indexedAt } }, { upsert: true });
    if (!result.upsertedCount || record.removed) return;
    const tokenId = await this.tokenIdForEvent(parsed);
    if (!tokenId) return;
    const existing = await this.models.FranchiseCertificate.findOne({ chainId: record.chainId, deploymentVersion: record.deploymentVersion, registryAddress: record.registryAddress, tokenId }).lean();
    const metadataURI = parsed.name === 'FranchiseRegistered' ? parsed.args.metadataURI : existing?.metadataURI;
    if (!metadataURI) throw new Error(`Franchise #${tokenId} has no canonical metadata URI.`);
    const current = await this.readCertificate(tokenId, metadataURI, evidence(log, parsed.name));
    await this.models.FranchiseCertificate.updateOne({ chainId: current.chainId, deploymentVersion: current.deploymentVersion, registryAddress: current.registryAddress, tokenId: current.tokenId }, { $set: { ...current, registrationEvidence: parsed.name === 'FranchiseRegistered' ? evidence(log, parsed.name) : existing?.registrationEvidence, indexedAt: new Date() } }, { upsert: true });
    await this.models.FranchiseHistory.updateOne({ chainId: current.chainId, deploymentVersion: current.deploymentVersion, registryAddress: current.registryAddress, 'evidence.transactionHash': record.transactionHash, 'evidence.logIndex': record.logIndex }, { $setOnInsert: { chainId: current.chainId, deploymentVersion: current.deploymentVersion, registryAddress: current.registryAddress, tokenId: current.tokenId, eventName: parsed.name, args: record.args, evidence: evidence(log, parsed.name), indexedAt: new Date() } }, { upsert: true });
  }
  async syncOnce() {
    await this.assertDeployment();
    let checkpoint = await this.models.FranchiseCheckpoint.findOne(this.identity()).lean();
    // A checkpoint without this scope predates the canonical projection. It
    // cannot prove that its event/certificate collections represent the same
    // deployment, so rebuild this isolated projection instead of serving an
    // apparently healthy but empty API.
    if (requiresProjectionRebuild(checkpoint)) {
      const identity = this.identity();
      await Promise.all([
        this.models.FranchiseEvent.deleteMany(this.unscopedIdentity()),
        this.models.FranchiseCertificate.deleteMany(this.unscopedIdentity()),
        this.models.FranchiseHistory.deleteMany(this.unscopedIdentity()),
        this.models.FranchiseCheckpoint.deleteOne(identity),
      ]);
      checkpoint = null;
    }
    if (checkpoint?.lastProcessedBlock) { const block = await this.provider.getBlock(Number(checkpoint.lastProcessedBlock)); if (!block || lower(block.hash) !== lower(checkpoint.lastProcessedBlockHash)) throw new Error('Franchise indexer checkpoint does not match the active chain.'); }
    const latest = await this.provider.getBlockNumber(); const target = latest - this.confirmations;
    let from = checkpoint?.lastProcessedBlock ? Number(checkpoint.lastProcessedBlock) + 1 : this.provenanceStartBlock();
    if (target < from) return { checkpoint: checkpoint?.lastProcessedBlock || null, processed: 0 };
    for (; from <= target; from += this.blockRange) {
      const to = Math.min(target, from + this.blockRange - 1);
      const logs = await this.provider.getLogs({ address: this.manifest.registryAddress, topics: [this.topics], fromBlock: from, toBlock: to });
      logs.sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber) || Number(a.index ?? a.logIndex) - Number(b.index ?? b.logIndex));
      for (const log of logs) await this.processLog(log);
      const block = await this.provider.getBlock(to);
      await this.models.FranchiseCheckpoint.updateOne(this.identity(), { $set: { projectionScope: SCOPE, lastProcessedBlock: String(to), lastProcessedBlockHash: lower(block.hash), indexedAt: new Date() } }, { upsert: true });
    }
    return { checkpoint: String(target), processed: target };
  }
  async start(pollIntervalMs = 5000) { if (this.running) return; this.running = true; const loop = async () => { if (!this.running) return; try { await this.syncOnce(); this.logger.info({ component: 'franchise-indexer', message: 'Synchronization cycle completed' }); } catch (error) { this.logger.error({ component: 'franchise-indexer', message: 'Synchronization cycle failed', error: error.message }); } if (this.running) this.timer = setTimeout(loop, pollIntervalMs); }; await loop(); }
  async stop() { this.running = false; if (this.timer) clearTimeout(this.timer); }
}

module.exports = { SCOPE, EVENTS, FranchiseIndexer, requiresProjectionRebuild };
