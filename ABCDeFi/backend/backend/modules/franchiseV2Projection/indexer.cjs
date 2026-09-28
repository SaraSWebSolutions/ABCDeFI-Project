const { Contract, Interface } = require('ethers');
const { projectionRuntimeFields, checkpointRuntimeFields, checkpointRuntimeMatches } = require('../../config/projectionRuntimeContext.cjs');

const SCOPE = 'canonical-franchise-v2-legion-bound';
const EVENTS = Object.freeze([
  'FranchiseApplicationSubmitted', 'FranchiseApplicationApproved', 'FranchiseApplicationRejected', 'FranchiseApplicationCancelled',
  'FranchiseMinted', 'FranchiseTransferRequested', 'FranchiseTransferApproved', 'FranchiseTransferCancelled', 'FranchiseTransferred',
  'FranchiseStatusChanged', 'FranchiseMetadataUpdated', 'Paused', 'Unpaused', 'RoleGranted', 'RoleRevoked', 'RoleAdminChanged',
]);
const APPLICATION_STATUSES = Object.freeze(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'MINTED']);
const FRANCHISE_STATUSES = Object.freeze(['ACTIVE', 'SUSPENDED', 'REVOKED']);
const lower = (value) => typeof value === 'string' ? value.toLowerCase() : value;
const stringify = (value) => typeof value === 'bigint' ? value.toString() : value;
const eventArgs = (parsed) => Object.fromEntries(parsed.fragment.inputs.map((input, index) => [input.name || String(index), stringify(parsed.args[index])]));

class FranchiseV2Indexer {
  constructor({ manifest, artifacts, provider, models, logger = console, confirmations = 2, blockRange = 250 }) {
    this.manifest = manifest; this.provider = provider; this.models = models; this.logger = logger; this.confirmations = confirmations; this.blockRange = blockRange;
    this.iface = new Interface(artifacts.registry.abi); this.registry = new Contract(manifest.registryAddress, artifacts.registry.abi, provider); this.nft = new Contract(manifest.nftAddress, artifacts.nft.abi, provider);
    this.topics = EVENTS.map((name) => this.iface.getEvent(name).topicHash); this.running = false;
  }
  identity() { return { chainId: String(this.manifest.chainId), deploymentVersion: this.manifest.deploymentVersion, ...projectionRuntimeFields(this.manifest), registryAddress: this.manifest.registryAddress }; }
  async assertDeployment() {
    const [network, registryCode, nftCode, legionCode, boundRegistry, boundLegion, boundNft] = await Promise.all([
      this.provider.getNetwork(), this.provider.getCode(this.manifest.registryAddress), this.provider.getCode(this.manifest.nftAddress), this.provider.getCode(this.manifest.legionAddress),
      this.nft.registry(), this.registry.legionNFT(), this.registry.franchiseNFT(),
    ]);
    if (Number(network.chainId) !== this.manifest.chainId) throw new Error(`RPC chain ${network.chainId} does not match canonical Franchise V2 chain ${this.manifest.chainId}.`);
    if ([registryCode, nftCode, legionCode].some((code) => code === '0x' || code === '0x0')) throw new Error('Canonical Legion-bound Franchise V2 bytecode is unavailable.');
    if (lower(boundRegistry) !== this.manifest.registryAddress || lower(boundLegion) !== this.manifest.legionAddress || lower(boundNft) !== this.manifest.nftAddress) throw new Error('Canonical Franchise V2 contract binding does not match the deployment manifest.');
  }
  async readFranchise(tokenId) {
    const [record, owner, requestId] = await Promise.all([this.registry.getFranchise(tokenId), this.nft.ownerOf(tokenId), this.registry.activeTransferRequestForToken(tokenId)]);
    const status = FRANCHISE_STATUSES[Number(record.status)]; if (!status) throw new Error(`Franchise V2 returned unknown status for token ${tokenId}.`);
    return { ...this.identity(), tokenId: String(tokenId), legionContract: lower(record.legionContract), legionTokenId: String(record.legionTokenId), owner: lower(owner), operator: lower(record.operator), status, operatorVersion: String(record.operatorVersion), metadataURI: record.metadataURI, activeTransferRequestId: String(requestId) };
  }
  async readApplication(applicationId) {
    const item = await this.registry.getApplication(applicationId); const status = APPLICATION_STATUSES[Number(item.status)]; if (!status) throw new Error(`Franchise V2 returned unknown application status for ${applicationId}.`);
    return { ...this.identity(), applicationId: String(applicationId), applicant: lower(item.applicant), legionTokenId: String(item.legionTokenId), metadataURI: item.metadataURI, status };
  }
  async readRequest(requestId) {
    const item = await this.registry.getTransferRequest(requestId);
    return { ...this.identity(), requestId: String(requestId), tokenId: String(item.tokenId), currentOperator: lower(item.currentOperator), proposedOperator: lower(item.proposedOperator), operatorVersion: String(item.operatorVersion), active: Boolean(item.active), approved: Boolean(item.approved) };
  }
  async upsertFranchise(tokenId) { const item = await this.readFranchise(tokenId); await this.models.FranchiseV2.updateOne({ ...this.identity(), tokenId: item.tokenId }, { $set: { ...item, indexedAt: new Date() } }, { upsert: true }); return item; }
  async upsertApplication(applicationId) { const item = await this.readApplication(applicationId); await this.models.FranchiseV2Application.updateOne({ ...this.identity(), applicationId: item.applicationId }, { $set: { ...item, indexedAt: new Date() } }, { upsert: true }); return item; }
  async upsertRequest(requestId) { const item = await this.readRequest(requestId); await this.models.FranchiseV2TransferRequest.updateOne({ ...this.identity(), requestId: item.requestId }, { $set: { ...item, indexedAt: new Date() } }, { upsert: true }); return item; }
  async processLog(log) {
    const parsed = this.iface.parseLog({ topics: log.topics, data: log.data }); if (!parsed || !EVENTS.includes(parsed.name)) return;
    let tokenId = parsed.args.tokenId === undefined ? null : String(parsed.args.tokenId);
    const applicationId = parsed.args.applicationId === undefined ? null : String(parsed.args.applicationId);
    const requestId = parsed.args.requestId === undefined ? null : String(parsed.args.requestId);
    // Approval/cancellation events identify a transfer request, not the token.
    // Resolve that canonical Registry relation before persisting the event so
    // token history remains complete without synthetic events.
    if (requestId !== null && tokenId === null) tokenId = (await this.readRequest(requestId)).tokenId;
    const record = { ...this.identity(), transactionHash: lower(log.transactionHash), blockNumber: String(log.blockNumber), transactionIndex: Number(log.transactionIndex), logIndex: Number(log.index ?? log.logIndex), blockHash: lower(log.blockHash), eventName: parsed.name, tokenId, applicationId, requestId, args: eventArgs(parsed), removed: Boolean(log.removed) };
    const { removed, ...immutable } = record;
    const persisted = await this.models.FranchiseV2Event.updateOne({ ...this.identity(), transactionHash: record.transactionHash, logIndex: record.logIndex }, { $setOnInsert: immutable, $set: { removed, indexedAt: new Date() } }, { upsert: true });
    if (!persisted.upsertedCount || record.removed) return;
    if (applicationId !== null) { const application = await this.upsertApplication(applicationId); if (application.status === 'MINTED') { const minted = await this.models.FranchiseV2Event.findOne({ ...this.identity(), applicationId, eventName: 'FranchiseMinted', removed: false }).lean(); if (minted?.tokenId) await this.upsertFranchise(minted.tokenId); } }
    if (requestId !== null) { const request = await this.upsertRequest(requestId); await this.upsertFranchise(request.tokenId); }
    if (tokenId !== null && parsed.name !== 'FranchiseApplicationSubmitted') await this.upsertFranchise(tokenId);
  }
  async syncOnce() {
    await this.assertDeployment(); const runtime = await checkpointRuntimeFields(this.manifest, this.provider, [this.manifest.registryAddress, this.manifest.nftAddress, this.manifest.legionAddress]); const checkpoint = await this.models.FranchiseV2Checkpoint.findOne({ ...this.identity(), scope: SCOPE }).lean();
    if (checkpoint && !checkpointRuntimeMatches(checkpoint, runtime)) throw new Error('Franchise V2 checkpoint runtime identity does not match the active canonical deployment.');
    if (checkpoint?.lastProcessedBlock) { const block = await this.provider.getBlock(Number(checkpoint.lastProcessedBlock)); if (!block || lower(block.hash) !== lower(checkpoint.lastProcessedBlockHash)) throw new Error('Franchise V2 checkpoint does not match the active chain; refusing stale projection.'); }
    const latest = await this.provider.getBlockNumber(); const target = latest - this.confirmations; let from = checkpoint?.lastProcessedBlock ? Number(checkpoint.lastProcessedBlock) + 1 : this.manifest.registryDeploymentBlock;
    if (target < from) return { checkpoint: checkpoint?.lastProcessedBlock || null, processed: 0 };
    for (; from <= target; from += this.blockRange) {
      const to = Math.min(target, from + this.blockRange - 1); const logs = await this.provider.getLogs({ address: this.manifest.registryAddress, topics: [this.topics], fromBlock: from, toBlock: to });
      logs.sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber) || Number(a.index ?? a.logIndex) - Number(b.index ?? b.logIndex));
      for (const log of logs) await this.processLog(log);
      const block = await this.provider.getBlock(to); await this.models.FranchiseV2Checkpoint.updateOne({ ...this.identity(), scope: SCOPE }, { $set: { ...runtime, lastProcessedBlock: String(to), lastProcessedBlockHash: lower(block.hash), paused: Boolean(await this.registry.paused()), indexedAt: new Date() } }, { upsert: true });
    }
    return { checkpoint: String(target), processed: target };
  }
  async start(pollIntervalMs = 5000) { if (this.running) return; this.running = true; const loop = async () => { if (!this.running) return; try { await this.syncOnce(); this.logger.info({ component: 'franchise-v2-indexer', message: 'Synchronization cycle completed' }); } catch (error) { this.logger.error({ component: 'franchise-v2-indexer', message: error.message }); } if (this.running) this.timer = setTimeout(loop, pollIntervalMs); }; await loop(); }
  async stop() { this.running = false; if (this.timer) clearTimeout(this.timer); }
}

module.exports = { SCOPE, EVENTS, APPLICATION_STATUSES, FRANCHISE_STATUSES, FranchiseV2Indexer, lower, stringify };
