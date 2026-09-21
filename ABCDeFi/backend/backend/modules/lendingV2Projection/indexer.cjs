const { Interface } = require('ethers');
const SCOPE = 'canonical-lending-v2';
const requiredNames = ['OracleAdapterV2', 'CollateralVaultV2', 'LoanManagerV2', 'LendingPoolV2', 'LiquidationV2', 'InsuranceReserveV2', 'LoanMarketplaceV2', 'EMIManagerV2', 'LoanNFTV2'];
const optionalNames = ['LendingReferralManagerV2', 'LiquidationSaleAdapterV2'];
const namesFor = (manifest) => [...requiredNames, ...optionalNames.filter((name) => manifest.contracts[name])];
const lower = (value) => typeof value === 'string' ? value.toLowerCase() : value;
const decimal = (value) => typeof value === 'bigint' ? value.toString() : Array.isArray(value) ? value.map(decimal) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decimal(item)])) : value;
const compareLogs = (left, right) => Number(left.blockNumber) - Number(right.blockNumber)
  || Number(left.transactionIndex) - Number(right.transactionIndex)
  || Number(left.index) - Number(right.index);

function registry(manifest, artifacts) {
  const result = new Map();
  for (const name of namesFor(manifest)) {
    const iface = new Interface(artifacts[name].abi);
    const address = lower(manifest.contracts[name].address);
    for (const fragment of iface.fragments.filter((item) => item.type === 'event')) result.set(`${address}:${lower(fragment.topicHash)}`, { name, iface, fragment });
  }
  return result;
}

class LendingV2Indexer {
  constructor({ manifest, artifacts, provider, models, logger = console, confirmations = 2, blockRange = 250 }) {
    this.manifest = manifest; this.provider = provider; this.models = models; this.logger = logger; this.confirmations = confirmations; this.blockRange = blockRange; this.names = namesFor(manifest); this.registry = registry(manifest, artifacts); this.timer = null;
  }
  identity() { return { chainId: String(this.manifest.chainId), deploymentVersion: this.manifest.deploymentVersion, scope: SCOPE }; }
  async rebuildDivergentProjection() {
    const projectionIdentity = { chainId: String(this.manifest.chainId), deploymentVersion: this.manifest.deploymentVersion };
    await this.models.V2ChainEvent.deleteMany(projectionIdentity);
    await this.models.V2BlockCheckpoint.deleteOne(this.identity());
  }
  async assertDeployment() {
    const network = await this.provider.getNetwork();
    if (Number(network.chainId) !== this.manifest.chainId) throw new Error(`V2 RPC chain ${network.chainId} does not match 31337.`);
    for (const name of this.names) if (await this.provider.getCode(this.manifest.contracts[name].address) === '0x') throw new Error(`V2 ${name} has no bytecode at its manifest address.`);
  }
  async syncOnce() {
    await this.assertDeployment();
    const latest = await this.provider.getBlockNumber(); const confirmed = latest - this.confirmations;
    if (confirmed < this.manifest.deploymentBlock) return null;
    let checkpoint = await this.models.V2BlockCheckpoint.findOne(this.identity()).lean();
    if (checkpoint?.lastProcessedBlockHash) {
      const block = await this.provider.getBlock(Number(checkpoint.lastProcessedBlock));
      if (!block || lower(block.hash) !== lower(checkpoint.lastProcessedBlockHash)) {
        // A deployment-version scoped rebuild is the only safe response to a
        // divergent canonical chain: stale raw events must not survive or be
        // merged with the replacement chain's transaction/log identities.
        await this.rebuildDivergentProjection();
        checkpoint = null;
      }
    }
    let from = checkpoint?.lastProcessedBlock == null ? this.manifest.deploymentBlock : Number(checkpoint.lastProcessedBlock) + 1;
    const addresses = this.names.map((name) => this.manifest.contracts[name].address);
    const blockCache = new Map();
    const blockAt = async (number) => {
      const key = Number(number);
      if (!blockCache.has(key)) blockCache.set(key, await this.provider.getBlock(key));
      const block = blockCache.get(key);
      if (!block) throw new Error(`Canonical Lending V2 block ${key} is unavailable during indexing.`);
      return block;
    };
    while (from <= confirmed) {
      const to = Math.min(confirmed, from + this.blockRange - 1);
      const logs = await this.provider.getLogs({ address: addresses, fromBlock: from, toBlock: to });
      logs.sort(compareLogs);
      for (const log of logs) {
        const def = this.registry.get(`${lower(log.address)}:${lower(log.topics[0])}`); if (!def) continue;
        const parsed = def.iface.parseLog(log); if (!parsed) continue;
        const args = {}; parsed.fragment.inputs.forEach((input, index) => { args[input.name || String(index)] = decimal(parsed.args[index]); });
        const block = await blockAt(log.blockNumber);
        await this.models.V2ChainEvent.updateOne({ chainId: String(this.manifest.chainId), deploymentVersion: this.manifest.deploymentVersion, transactionHash: lower(log.transactionHash), logIndex: Number(log.index) }, { $setOnInsert: {
          chainId: String(this.manifest.chainId), deploymentVersion: this.manifest.deploymentVersion, contractAddress: lower(log.address), contractName: def.name,
          transactionHash: lower(log.transactionHash), blockNumber: String(log.blockNumber), blockNumberNumeric: Number(log.blockNumber), blockTimestamp: String(block.timestamp),
          transactionIndex: Number(log.transactionIndex), logIndex: Number(log.index), blockHash: lower(log.blockHash), eventName: parsed.name, args,
        } }, { upsert: true });
      }
      const block = await blockAt(to);
      await this.models.V2BlockCheckpoint.updateOne(this.identity(), { $set: { lastProcessedBlock: String(to), lastProcessedBlockHash: lower(block.hash), indexedAt: new Date() } }, { upsert: true });
      from = to + 1;
    }
    return this.models.V2BlockCheckpoint.findOne(this.identity()).lean();
  }
  async start(intervalMs = 5000) { await this.syncOnce(); this.timer = setInterval(() => this.syncOnce().catch((error) => this.logger.error({ component: 'lending-v2-indexer', message: error.message })), intervalMs); }
  async stop() { if (this.timer) clearInterval(this.timer); }
}
module.exports = { LendingV2Indexer, SCOPE };
