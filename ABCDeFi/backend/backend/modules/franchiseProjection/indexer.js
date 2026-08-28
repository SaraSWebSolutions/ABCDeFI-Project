const { Contract, Interface } = require('ethers');

const SCOPE = 'canonical-franchise-v1';
const EVENTS = ['FranchiseNFTMinted', 'Transfer'];
const lower = (value) => typeof value === 'string' ? value.toLowerCase() : value;
const asString = (value) => BigInt(value).toString();

function evidence(log, eventName) { return { transactionHash: lower(log.transactionHash), blockNumber: String(log.blockNumber), logIndex: Number(log.index ?? log.logIndex), blockHash: lower(log.blockHash), eventName }; }
function eventArgs(parsed) { return Object.fromEntries(parsed.fragment.inputs.map((input, index) => [input.name || String(index), typeof parsed.args[index] === 'bigint' ? parsed.args[index].toString() : parsed.args[index]])); }

class FranchiseIndexer {
  constructor({ manifest, artifact, provider, models, logger = console, confirmations = 2, blockRange = 250 }) {
    this.manifest = manifest; this.provider = provider; this.models = models; this.logger = logger; this.confirmations = confirmations; this.blockRange = blockRange;
    this.iface = new Interface(artifact.abi); this.contract = new Contract(manifest.contractAddress, artifact.abi, provider); this.running = false; this.timer = null;
    this.topics = EVENTS.map((name) => this.iface.getEvent(name).topicHash);
  }
  identity() { return { chainId: String(this.manifest.chainId), deploymentVersion: this.manifest.deploymentVersion, contractAddress: this.manifest.contractAddress }; }
  async assertDeployment() {
    const [network, code] = await Promise.all([this.provider.getNetwork(), this.provider.getCode(this.manifest.contractAddress)]);
    if (Number(network.chainId) !== this.manifest.chainId) throw new Error(`RPC chain ${network.chainId} does not match canonical FranchiseNFT chain ${this.manifest.chainId}`);
    if (code === '0x' || code === '0x0') throw new Error(`No FranchiseNFT bytecode exists at ${this.manifest.contractAddress}; local chain and deployments.json do not match.`);
  }
  async readCertificate(tokenId, latestEvidence) {
    const [owner, data, tokenUri] = await Promise.all([this.contract.ownerOf(tokenId), this.contract.getFranchiseDetails(tokenId), this.contract.tokenURI(tokenId)]);
    return { chainId: String(this.manifest.chainId), contractAddress: this.manifest.contractAddress, tokenId: asString(tokenId), owner: lower(owner), franchiseName: data.franchiseName, territoryCode: data.territoryCode, territoryName: data.territoryName, level: asString(data.level), legionNFTId: asString(data.legionNFTId), priceUSD: asString(data.priceUSD), commissionBps: asString(data.commissionBps), purchaseTimestamp: asString(data.purchaseTimestamp), lockExpiryTimestamp: asString(data.lockExpiryTimestamp), status: asString(data.status), tokenUri, ipfsCID: data.ipfsCID, latestEvidence };
  }
  async processLog(log) {
    const parsed = this.iface.parseLog({ topics: log.topics, data: log.data });
    if (!parsed || !EVENTS.includes(parsed.name)) return;
    const record = { chainId: String(this.manifest.chainId), contractAddress: this.manifest.contractAddress, transactionHash: lower(log.transactionHash), blockNumber: String(log.blockNumber), logIndex: Number(log.index ?? log.logIndex), blockHash: lower(log.blockHash), eventName: parsed.name, args: eventArgs(parsed), removed: Boolean(log.removed), indexedAt: new Date() };
    const raw = await this.models.FranchiseEvent.updateOne({ chainId: record.chainId, transactionHash: record.transactionHash, logIndex: record.logIndex }, { $setOnInsert: record, $set: { removed: record.removed, indexedAt: new Date() } }, { upsert: true });
    if (!raw.upsertedCount || record.removed) return;
    const tokenId = parsed.name === 'Transfer' ? parsed.args.tokenId : parsed.args.franchiseId;
    const current = await this.readCertificate(tokenId, evidence(log, parsed.name));
    const existing = await this.models.FranchiseCertificate.findOne({ chainId: current.chainId, contractAddress: current.contractAddress, tokenId: current.tokenId }).lean();
    await this.models.FranchiseCertificate.updateOne({ chainId: current.chainId, contractAddress: current.contractAddress, tokenId: current.tokenId }, { $set: { ...current, mintEvidence: parsed.name === 'FranchiseNFTMinted' ? evidence(log, parsed.name) : (existing?.mintEvidence || evidence(log, parsed.name)), indexedAt: new Date() } }, { upsert: true });
    await this.models.FranchiseHistory.updateOne({ chainId: current.chainId, 'evidence.transactionHash': record.transactionHash, 'evidence.logIndex': record.logIndex }, { $setOnInsert: { chainId: current.chainId, contractAddress: current.contractAddress, tokenId: current.tokenId, from: parsed.name === 'Transfer' ? lower(parsed.args.from) : null, to: parsed.name === 'Transfer' ? lower(parsed.args.to) : lower(parsed.args.franchisee), eventName: parsed.name, evidence: evidence(log, parsed.name), indexedAt: new Date() } }, { upsert: true });
  }
  async syncOnce() {
    await this.assertDeployment();
    const checkpoint = await this.models.FranchiseCheckpoint.findOne(this.identity()).lean();
    if (checkpoint?.lastProcessedBlock) {
      const block = await this.provider.getBlock(Number(checkpoint.lastProcessedBlock));
      if (!block || lower(block.hash) !== lower(checkpoint.lastProcessedBlockHash)) throw new Error('Franchise indexer checkpoint does not match the active chain; restart from a canonical fresh deployment rather than serving stale data.');
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
      await this.models.FranchiseCheckpoint.updateOne(this.identity(), { $set: { lastProcessedBlock: String(to), lastProcessedBlockHash: lower(block.hash), indexedAt: new Date() } }, { upsert: true });
    }
    return { checkpoint: String(target), processed: target };
  }
  async start(pollIntervalMs = 5000) { if (this.running) return; this.running = true; const loop = async () => { if (!this.running) return; try { await this.syncOnce(); this.logger.info({ component: 'franchise-indexer', message: 'Synchronization cycle completed' }); } catch (error) { this.logger.error({ component: 'franchise-indexer', message: 'Synchronization cycle failed', error: error.message }); } if (this.running) this.timer = setTimeout(loop, pollIntervalMs); }; await loop(); }
  async stop() { this.running = false; if (this.timer) clearTimeout(this.timer); }
}

module.exports = { SCOPE, EVENTS, FranchiseIndexer };
