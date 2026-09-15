const { Contract, Interface } = require('ethers');

const SCOPE = 'canonical-legion-credential-v2';
const EVENTS = Object.freeze([
  'Transfer',
  'LegionCredentialMinted',
  'LegionCredentialStatusUpdated',
  'LegionCredentialCategoryUpdated',
  'LegionCredentialMetadataUpdated',
  'LegionCredentialSuspended',
  'LegionCredentialReactivated',
  'LegionCredentialRevoked',
  'LegionCredentialMigrated',
]);
const STATUSES = Object.freeze(['ACTIVE', 'SUSPENDED', 'REVOKED']);
const lower = (value) => typeof value === 'string' ? value.toLowerCase() : value;
const stringValue = (value) => typeof value === 'bigint' ? value.toString() : value;
const eventEvidence = (log, eventName) => ({
  transactionHash: lower(log.transactionHash), blockNumber: String(log.blockNumber), logIndex: Number(log.index ?? log.logIndex), blockHash: lower(log.blockHash), eventName,
});
const eventArgs = (parsed) => Object.fromEntries(parsed.fragment.inputs.map((input, index) => [input.name || String(index), stringValue(parsed.args[index])]));
const tokenIdFor = (parsed) => {
  const tokenId = parsed.args.tokenId;
  return tokenId === undefined ? null : stringValue(tokenId);
};

class LegionCredentialIndexer {
  constructor({ manifest, artifact, provider, models, logger = console, confirmations = 2, blockRange = 250 }) {
    this.manifest = manifest; this.provider = provider; this.models = models; this.logger = logger; this.confirmations = confirmations; this.blockRange = blockRange;
    this.iface = new Interface(artifact.abi); this.contract = new Contract(manifest.contractAddress, artifact.abi, provider);
    this.topics = EVENTS.map((name) => this.iface.getEvent(name).topicHash);
    this.running = false; this.timer = null;
  }

  identity() { return { chainId: String(this.manifest.chainId), deploymentVersion: this.manifest.deploymentVersion, contractAddress: this.manifest.contractAddress, scope: SCOPE }; }

  async assertDeployment() {
    const [network, code] = await Promise.all([this.provider.getNetwork(), this.provider.getCode(this.manifest.contractAddress)]);
    if (Number(network.chainId) !== this.manifest.chainId) throw new Error(`RPC chain ${network.chainId} does not match canonical LegionCredentialV2 chain ${this.manifest.chainId}.`);
    if (code === '0x' || code === '0x0') throw new Error(`No LegionCredentialV2 bytecode exists at ${this.manifest.contractAddress}; the manifest cannot be treated as deployed.`);
  }

  async readCredential(tokenId, latestEvidence) {
    const [owner, credential, metadataURI] = await Promise.all([
      this.contract.ownerOf(tokenId), this.contract.getCredential(tokenId), this.contract.tokenURI(tokenId),
    ]);
    const status = STATUSES[Number(credential.status)];
    if (!status) throw new Error(`LegionCredentialV2 returned an unknown credential status for token ${tokenId}.`);
    return {
      chainId: String(this.manifest.chainId), deploymentVersion: this.manifest.deploymentVersion, contractAddress: this.manifest.contractAddress,
      tokenId: String(tokenId), owner: lower(owner), active: status === 'ACTIVE', status, category: credential.category,
      metadataURI, issuedAt: String(credential.issuedAt), updatedAt: String(credential.updatedAt), latestEvidence,
    };
  }

  async processLog(log) {
    const parsed = this.iface.parseLog({ topics: log.topics, data: log.data });
    if (!parsed || !EVENTS.includes(parsed.name)) return;
    const tokenId = tokenIdFor(parsed);
    const record = {
      chainId: String(this.manifest.chainId), deploymentVersion: this.manifest.deploymentVersion, contractAddress: this.manifest.contractAddress,
      transactionHash: lower(log.transactionHash), blockNumber: String(log.blockNumber), transactionIndex: Number(log.transactionIndex), logIndex: Number(log.index ?? log.logIndex),
      blockHash: lower(log.blockHash), eventName: parsed.name, tokenId, args: eventArgs(parsed), removed: Boolean(log.removed), indexedAt: new Date(),
    };
    // Replay state is refreshed through $set. MongoDB rejects an upsert that
    // also places the same field in $setOnInsert.
    const { removed, indexedAt: _indexedAt, ...insertRecord } = record;
    const persisted = await this.models.LegionCredentialEvent.updateOne(
      { chainId: record.chainId, deploymentVersion: record.deploymentVersion, transactionHash: record.transactionHash, logIndex: record.logIndex },
      { $setOnInsert: insertRecord, $set: { removed, indexedAt: new Date() } }, { upsert: true },
    );
    if (!persisted.upsertedCount || record.removed || tokenId === null) return;

    const latestEvidence = eventEvidence(log, parsed.name);
    const current = await this.readCredential(tokenId, latestEvidence);
    const existing = await this.models.LegionCredential.findOne({ chainId: current.chainId, deploymentVersion: current.deploymentVersion, contractAddress: current.contractAddress, tokenId }).lean();
    await this.models.LegionCredential.updateOne(
      { chainId: current.chainId, deploymentVersion: current.deploymentVersion, contractAddress: current.contractAddress, tokenId },
      { $set: { ...current, mintEvidence: parsed.name === 'LegionCredentialMinted' ? latestEvidence : (existing?.mintEvidence || latestEvidence), indexedAt: new Date() } },
      { upsert: true },
    );
  }

  async syncOnce() {
    await this.assertDeployment();
    const checkpoint = await this.models.LegionCredentialCheckpoint.findOne(this.identity()).lean();
    if (checkpoint?.lastProcessedBlock) {
      const block = await this.provider.getBlock(Number(checkpoint.lastProcessedBlock));
      if (!block || lower(block.hash) !== lower(checkpoint.lastProcessedBlockHash)) throw new Error('Legion credential checkpoint does not match the active chain; refusing to serve a stale projection.');
    }
    const latest = await this.provider.getBlockNumber(); const target = latest - this.confirmations;
    let from = checkpoint?.lastProcessedBlock ? Number(checkpoint.lastProcessedBlock) + 1 : this.manifest.deploymentBlock;
    if (target < from) return { checkpoint: checkpoint?.lastProcessedBlock || null, processed: 0 };
    for (; from <= target; from += this.blockRange) {
      const to = Math.min(target, from + this.blockRange - 1);
      const logs = await this.provider.getLogs({ address: this.manifest.contractAddress, topics: [this.topics], fromBlock: from, toBlock: to });
      logs.sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber) || Number(a.index ?? a.logIndex) - Number(b.index ?? b.logIndex));
      for (const log of logs) await this.processLog(log);
      const block = await this.provider.getBlock(to);
      await this.models.LegionCredentialCheckpoint.updateOne(this.identity(), { $set: { lastProcessedBlock: String(to), lastProcessedBlockHash: lower(block.hash), indexedAt: new Date() } }, { upsert: true });
    }
    return { checkpoint: String(target), processed: target };
  }

  async start(pollIntervalMs = 5000) {
    if (this.running) return;
    this.running = true;
    const loop = async () => {
      if (!this.running) return;
      try { await this.syncOnce(); this.logger.info({ component: 'legion-credential-indexer', message: 'Synchronization cycle completed' }); }
      catch (error) { this.logger.error({ component: 'legion-credential-indexer', message: 'Synchronization cycle failed', error: error.message }); }
      if (this.running) this.timer = setTimeout(loop, pollIntervalMs);
    };
    await loop();
  }

  async stop() { this.running = false; if (this.timer) clearTimeout(this.timer); }
}

module.exports = { SCOPE, EVENTS, LegionCredentialIndexer };
