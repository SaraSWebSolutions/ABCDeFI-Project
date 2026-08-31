const { Interface } = require('ethers');
const SCOPE = 'canonical-lending-v2';
const names = ['LendingPoolV2', 'CollateralVaultV2', 'LoanManagerV2', 'LiquidationV2', 'LoanMarketplaceV2', 'EMIManagerV2', 'LoanNFTV2'];
const lower = (value) => typeof value === 'string' ? value.toLowerCase() : value;
const decimal = (value) => typeof value === 'bigint' ? value.toString() : Array.isArray(value) ? value.map(decimal) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decimal(item)])) : value;

function registry(manifest, artifacts) {
  const result = new Map();
  for (const name of names) {
    const iface = new Interface(artifacts[name].abi);
    const address = lower(manifest.contracts[name].address);
    for (const fragment of iface.fragments.filter((item) => item.type === 'event')) result.set(`${address}:${lower(fragment.topicHash)}`, { name, iface, fragment });
  }
  return result;
}

class LendingV2Indexer {
  constructor({ manifest, artifacts, provider, models, logger = console, confirmations = 2, blockRange = 250 }) {
    this.manifest = manifest; this.provider = provider; this.models = models; this.logger = logger; this.confirmations = confirmations; this.blockRange = blockRange; this.registry = registry(manifest, artifacts); this.timer = null;
  }
  identity() { return { chainId: String(this.manifest.chainId), deploymentVersion: this.manifest.deploymentVersion, scope: SCOPE }; }
  async assertDeployment() {
    const network = await this.provider.getNetwork();
    if (Number(network.chainId) !== this.manifest.chainId) throw new Error(`V2 RPC chain ${network.chainId} does not match 31337.`);
    for (const name of names) if (await this.provider.getCode(this.manifest.contracts[name].address) === '0x') throw new Error(`V2 ${name} has no bytecode at its manifest address.`);
  }
  async syncOnce() {
    await this.assertDeployment();
    const latest = await this.provider.getBlockNumber(); const confirmed = latest - this.confirmations;
    if (confirmed < this.manifest.deploymentBlock) return null;
    const checkpoint = await this.models.V2BlockCheckpoint.findOne(this.identity()).lean();
    let from = checkpoint?.lastProcessedBlock == null ? this.manifest.deploymentBlock : Number(checkpoint.lastProcessedBlock) + 1;
    if (checkpoint?.lastProcessedBlockHash) {
      const block = await this.provider.getBlock(Number(checkpoint.lastProcessedBlock));
      if (!block || lower(block.hash) !== lower(checkpoint.lastProcessedBlockHash)) throw new Error('V2 checkpoint does not match the active chain; manual review is required before reindexing.');
    }
    const addresses = names.map((name) => this.manifest.contracts[name].address);
    while (from <= confirmed) {
      const to = Math.min(confirmed, from + this.blockRange - 1);
      const logs = await this.provider.getLogs({ address: addresses, fromBlock: from, toBlock: to });
      for (const log of logs) {
        const def = this.registry.get(`${lower(log.address)}:${lower(log.topics[0])}`); if (!def) continue;
        const parsed = def.iface.parseLog(log); if (!parsed) continue;
        const args = {}; parsed.fragment.inputs.forEach((input, index) => { args[input.name || String(index)] = decimal(parsed.args[index]); });
        await this.models.V2ChainEvent.updateOne({ chainId: String(this.manifest.chainId), deploymentVersion: this.manifest.deploymentVersion, transactionHash: lower(log.transactionHash), logIndex: Number(log.index) }, { $setOnInsert: {
          chainId: String(this.manifest.chainId), deploymentVersion: this.manifest.deploymentVersion, contractAddress: lower(log.address), contractName: def.name,
          transactionHash: lower(log.transactionHash), blockNumber: String(log.blockNumber), transactionIndex: Number(log.transactionIndex), logIndex: Number(log.index), blockHash: lower(log.blockHash), eventName: parsed.name, args,
        } }, { upsert: true });
      }
      const block = await this.provider.getBlock(to);
      await this.models.V2BlockCheckpoint.updateOne(this.identity(), { $set: { lastProcessedBlock: String(to), lastProcessedBlockHash: lower(block.hash), indexedAt: new Date() } }, { upsert: true });
      from = to + 1;
    }
    return this.models.V2BlockCheckpoint.findOne(this.identity()).lean();
  }
  async start(intervalMs = 5000) { await this.syncOnce(); this.timer = setInterval(() => this.syncOnce().catch((error) => this.logger.error({ component: 'lending-v2-indexer', message: error.message })), intervalMs); }
  async stop() { if (this.timer) clearInterval(this.timer); }
}
module.exports = { LendingV2Indexer, SCOPE };
